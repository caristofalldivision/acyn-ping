// Topha Agent v0.1
//
// Single-file Go program that:
//   1. Pairs once with `topha-agent pair <code>`  -> stores agent_id + secret in ~/.topha/agent.json
//   2. Polls Topha for pending jobs and runs them against MikroTik routers
//
// Drivers: SSH (default, works on RouterOS v6 + v7) and REST (RouterOS v7.1+).
// Job kinds handled: fetch_config, apply_script, take_backup, restore_backup, wizard_hotspot.
//
// Build:   go build -o topha-agent .
// Run:     ./topha-agent pair ABC123
//          ./topha-agent run
//
// No external deps beyond the Go stdlib + golang.org/x/crypto/ssh.

package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"os/user"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"golang.org/x/crypto/ssh"
)

const (
	defaultBase  = "https://felddksssxwpehozsbmt.supabase.co/functions/v1"
	pollInterval = 5 * time.Second
	httpTimeout  = 30 * time.Second
)

type config struct {
	BaseURL     string `json:"base_url"`
	AgentID     string `json:"agent_id"`
	AgentSecret string `json:"agent_secret"`
}

type device struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Vendor           string `json:"vendor"`
	Host             string `json:"host"`
	Port             int    `json:"port"`
	ConnectionMethod string `json:"connection_method"`
	Username         string `json:"username"`
	// Wire field is named "credential_encrypted" for compatibility, but the
	// agent only sees the plaintext password the operator entered.
	Password string `json:"credential_encrypted"`
}

type job struct {
	ID            string  `json:"id"`
	Kind          string  `json:"kind"`
	ScriptContent *string `json:"script_content"`
	DeviceID      string  `json:"device_id"`
	Devices       device  `json:"devices"`
}

type wizardPayload struct {
	Plan struct {
		BackupName string `json:"backup_name"`
		Steps      []struct {
			ID               string   `json:"id"`
			Title            string   `json:"title"`
			Kind             string   `json:"kind"`
			Commands         []string `json:"commands"`
			RollbackCommands []string `json:"rollback_commands"`
		} `json:"steps"`
	} `json:"plan"`
	Script string `json:"script"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: topha-agent <pair <code> | run | status>")
		os.Exit(1)
	}
	switch os.Args[1] {
	case "pair":
		if len(os.Args) < 3 {
			die("usage: topha-agent pair <code>")
		}
		if err := doPair(os.Args[2]); err != nil {
			die(err.Error())
		}
		fmt.Println("paired successfully")
	case "run":
		runLoop()
	case "status":
		c, err := loadConfig()
		if err != nil {
			die(err.Error())
		}
		fmt.Printf("agent_id=%s base=%s\n", c.AgentID, c.BaseURL)
	default:
		die("unknown command: " + os.Args[1])
	}
}

// ---------------- pairing ----------------

func doPair(code string) error {
	base := envOr("TOPHA_BASE_URL", defaultBase)
	body, _ := json.Marshal(map[string]string{"pairing_code": code, "agent_name": hostname()})
	req, _ := http.NewRequest("POST", base+"/device-pair/claim", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("pair failed (%d): %s", resp.StatusCode, raw)
	}
	var out struct {
		AgentID     string `json:"agent_id"`
		AgentSecret string `json:"agent_secret"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return fmt.Errorf("bad pair response: %s", raw)
	}
	if out.AgentID == "" || out.AgentSecret == "" {
		return fmt.Errorf("missing fields in pair response: %s", raw)
	}
	return saveConfig(config{BaseURL: base, AgentID: out.AgentID, AgentSecret: out.AgentSecret})
}

// ---------------- main loop ----------------

func runLoop() {
	c, err := loadConfig()
	if err != nil {
		die("not paired yet — run: topha-agent pair <code>")
	}
	fmt.Printf("topha-agent online · agent_id=%s · polling %s\n", c.AgentID, c.BaseURL)

	ctx, cancel := context.WithCancel(context.Background())
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		s := <-sigCh
		fmt.Printf("\nreceived %s, shutting down...\n", s)
		cancel()
	}()

	for {
		select {
		case <-ctx.Done():
			fmt.Println("topha-agent stopped")
			return
		default:
		}
		jobs, err := fetchPending(c)
		if err != nil {
			fmt.Fprintf(os.Stderr, "poll error: %v\n", err)
		}
		for _, j := range jobs {
			handleJob(c, j)
		}
		select {
		case <-ctx.Done():
		case <-time.After(pollInterval):
		}
	}
}

func fetchPending(c config) ([]job, error) {
	req, _ := http.NewRequest("GET", c.BaseURL+"/device-jobs/pending", nil)
	req.Header.Set("X-Agent-Id", c.AgentID)
	req.Header.Set("X-Agent-Secret", c.AgentSecret)
	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("pending %d: %s", resp.StatusCode, raw)
	}
	var out struct {
		Jobs []job `json:"jobs"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out.Jobs, nil
}

// ---------------- job execution ----------------

func handleJob(c config, j job) {
	logf := func(line string) { sendLog(c, j.ID, line) }
	logf(fmt.Sprintf("== job %s · kind=%s · device=%s (%s)", j.ID[:8], j.Kind, j.Devices.Name, j.Devices.Host))

	exec, err := connectDevice(j.Devices)
	if err != nil {
		logf("ERROR connecting: " + err.Error())
		sendResult(c, j.ID, "failed", "", err.Error())
		return
	}
	defer exec.close()
	logf("connected via " + j.Devices.ConnectionMethod)

	switch j.Kind {
	case "fetch_config":
		out, err := exec.run("/export terse")
		if err != nil {
			logf("ERROR: " + err.Error())
			sendResult(c, j.ID, "failed", out, err.Error())
			return
		}
		sendResult(c, j.ID, "success", out, "")
	case "apply_script":
		if j.ScriptContent == nil {
			sendResult(c, j.ID, "failed", "", "no script content")
			return
		}
		out, err := exec.runScript(*j.ScriptContent, logf)
		status := "success"
		errStr := ""
		if err != nil {
			status = "failed"
			errStr = err.Error()
		}
		sendResult(c, j.ID, status, out, errStr)
	case "take_backup":
		name := "topha-" + time.Now().Format("20060102-150405")
		if j.ScriptContent != nil && *j.ScriptContent != "" {
			name = strings.TrimSpace(*j.ScriptContent)
		}
		out, err := exec.run("/system backup save name=" + name)
		status := "success"
		errStr := ""
		if err != nil {
			status = "failed"
			errStr = err.Error()
		}
		sendResult(c, j.ID, status, "backup="+name+"\n"+out, errStr)
	case "restore_backup":
		if j.ScriptContent == nil {
			sendResult(c, j.ID, "failed", "", "no backup name provided")
			return
		}
		name := strings.TrimSpace(*j.ScriptContent)
		out, err := exec.run("/system backup load name=" + name)
		status := "success"
		errStr := ""
		if err != nil {
			status = "failed"
			errStr = err.Error()
		}
		sendResult(c, j.ID, status, out, errStr)
	case "wizard_hotspot":
		runWizard(c, j, exec, logf)
	default:
		sendResult(c, j.ID, "failed", "", "unknown kind: "+j.Kind)
	}
}

func runWizard(c config, j job, exec deviceExec, logf func(string)) {
	if j.ScriptContent == nil {
		sendResult(c, j.ID, "failed", "", "no plan provided")
		return
	}
	var w wizardPayload
	if err := json.Unmarshal([]byte(*j.ScriptContent), &w); err != nil {
		sendResult(c, j.ID, "failed", "", "bad plan json: "+err.Error())
		return
	}
	var fullOut bytes.Buffer
	appliedRollbacks := [][]string{} // stack of inverse commands for steps we applied
	for i, s := range w.Plan.Steps {
		logf(fmt.Sprintf("[%d/%d] %s (%s)", i+1, len(w.Plan.Steps), s.Title, s.Kind))
		stepOut := bytes.Buffer{}
		failed := false
		var lastErr error
		for _, cmd := range s.Commands {
			out, err := exec.run(cmd)
			stepOut.WriteString("> " + cmd + "\n" + out + "\n")
			if err != nil {
				lastErr = err
				failed = true
				break
			}
		}
		fullOut.Write(stepOut.Bytes())
		logf(stepOut.String())
		if failed {
			logf(fmt.Sprintf("STEP FAILED: %v — running rollback", lastErr))
			// run this step's rollback + all previously-applied rollbacks (LIFO)
			toRollback := append([][]string{s.RollbackCommands}, appliedRollbacks...)
			for _, rcmds := range toRollback {
				for _, rc := range rcmds {
					out, _ := exec.run(rc)
					fullOut.WriteString("[rollback] " + rc + "\n" + out + "\n")
				}
			}
			sendResult(c, j.ID, "rolled_back", fullOut.String(), lastErr.Error())
			return
		}
		if s.Kind == "write" && len(s.RollbackCommands) > 0 {
			appliedRollbacks = append([][]string{s.RollbackCommands}, appliedRollbacks...)
		}
	}
	sendResult(c, j.ID, "success", fullOut.String(), "")
}

// ---------------- device drivers ----------------

type deviceExec interface {
	run(cmd string) (string, error)
	runScript(script string, logf func(string)) (string, error)
	close()
}

func connectDevice(d device) (deviceExec, error) {
	switch d.ConnectionMethod {
	case "ssh":
		return newSSH(d)
	case "rest":
		return newREST(d), nil
	default:
		// fall back to SSH (legacy "api" method also routes here for v0.1)
		return newSSH(d)
	}
}

// --- SSH driver ---

type sshExec struct {
	c *ssh.Client
}

func newSSH(d device) (*sshExec, error) {
	port := d.Port
	if port == 0 {
		port = 22
	}
	cfg := &ssh.ClientConfig{
		User:            d.Username,
		Auth:            []ssh.AuthMethod{ssh.Password(d.CredentialEncrypted)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         15 * time.Second,
	}
	c, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", d.Host, port), cfg)
	if err != nil {
		return nil, err
	}
	return &sshExec{c: c}, nil
}

func (s *sshExec) run(cmd string) (string, error) {
	sess, err := s.c.NewSession()
	if err != nil {
		return "", err
	}
	defer sess.Close()
	var out bytes.Buffer
	sess.Stdout = &out
	sess.Stderr = &out
	err = sess.Run(cmd)
	return out.String(), err
}

func (s *sshExec) runScript(script string, logf func(string)) (string, error) {
	var all bytes.Buffer
	for _, line := range strings.Split(script, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		logf("> " + line)
		out, err := s.run(line)
		all.WriteString(out)
		if err != nil {
			return all.String(), err
		}
	}
	return all.String(), nil
}

func (s *sshExec) close() { _ = s.c.Close() }

// --- REST driver (RouterOS v7.1+) ---

type restExec struct {
	d device
	c *http.Client
}

func newREST(d device) *restExec {
	return &restExec{
		d: d,
		c: &http.Client{
			Timeout:   httpTimeout,
			Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		},
	}
}

func (r *restExec) run(cmd string) (string, error) {
	// Translate a RouterOS CLI line into REST: e.g. "/ip address add address=1.1.1.1/24 interface=ether1"
	// becomes POST /rest/ip/address with body {address:..., interface:...}.
	parts := tokenize(cmd)
	if len(parts) == 0 {
		return "", nil
	}
	path := strings.TrimPrefix(parts[0], "/")
	verb := "POST"
	if len(parts) > 1 {
		switch parts[1] {
		case "add":
			verb = "PUT"
		case "print":
			verb = "GET"
		case "remove":
			verb = "POST"
			path = path + "/remove"
		case "set":
			verb = "PATCH"
		}
		path = strings.ReplaceAll(path, " ", "/")
	}
	body := map[string]string{}
	for _, p := range parts[2:] {
		if i := strings.Index(p, "="); i > 0 {
			body[p[:i]] = strings.Trim(p[i+1:], `"`)
		}
	}
	bb, _ := json.Marshal(body)
	port := r.d.Port
	if port == 0 {
		port = 443
	}
	url := fmt.Sprintf("https://%s:%d/rest/%s", r.d.Host, port, strings.ReplaceAll(path, " ", "/"))
	req, _ := http.NewRequest(verb, url, bytes.NewReader(bb))
	req.SetBasicAuth(r.d.Username, r.d.CredentialEncrypted)
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.c.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return string(raw), fmt.Errorf("REST %s %s -> %d", verb, url, resp.StatusCode)
	}
	return string(raw), nil
}

func (r *restExec) runScript(script string, logf func(string)) (string, error) {
	var all bytes.Buffer
	for _, line := range strings.Split(script, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		logf("> " + line)
		out, err := r.run(line)
		all.WriteString(out + "\n")
		if err != nil {
			return all.String(), err
		}
	}
	return all.String(), nil
}

func (r *restExec) close() {}

func tokenize(cmd string) []string {
	// Naive tokenizer: respects "quoted" sections.
	var out []string
	var cur bytes.Buffer
	inQ := false
	for _, ch := range cmd {
		switch {
		case ch == '"':
			inQ = !inQ
			cur.WriteRune(ch)
		case ch == ' ' && !inQ:
			if cur.Len() > 0 {
				out = append(out, cur.String())
				cur.Reset()
			}
		default:
			cur.WriteRune(ch)
		}
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}

// ---------------- topha API helpers ----------------

func sendLog(c config, jobID, line string) {
	body, _ := json.Marshal(map[string]string{"job_id": jobID, "line": line})
	req, _ := http.NewRequest("POST", c.BaseURL+"/device-jobs/log", bytes.NewReader(body))
	req.Header.Set("X-Agent-Id", c.AgentID)
	req.Header.Set("X-Agent-Secret", c.AgentSecret)
	req.Header.Set("Content-Type", "application/json")
	if resp, err := httpClient().Do(req); err == nil {
		resp.Body.Close()
	}
	fmt.Println("[" + jobID[:8] + "] " + line)
}

func sendResult(c config, jobID, status, output, errMsg string) {
	body, _ := json.Marshal(map[string]any{
		"job_id":     jobID,
		"status":     status,
		"output_log": output,
		"error":      errMsg,
	})
	req, _ := http.NewRequest("POST", c.BaseURL+"/device-jobs/result", bytes.NewReader(body))
	req.Header.Set("X-Agent-Id", c.AgentID)
	req.Header.Set("X-Agent-Secret", c.AgentSecret)
	req.Header.Set("Content-Type", "application/json")
	if resp, err := httpClient().Do(req); err == nil {
		resp.Body.Close()
	}
	fmt.Printf("[%s] result=%s\n", jobID[:8], status)
}

func httpClient() *http.Client {
	return &http.Client{
		Timeout:   httpTimeout,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: false}},
	}
}

// ---------------- config persistence ----------------

func configPath() (string, error) {
	u, err := user.Current()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(u.HomeDir, ".topha")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(dir, "agent.json"), nil
}

func loadConfig() (config, error) {
	p, err := configPath()
	if err != nil {
		return config{}, err
	}
	raw, err := os.ReadFile(p)
	if err != nil {
		return config{}, errors.New("not paired — run: topha-agent pair <code>")
	}
	var c config
	if err := json.Unmarshal(raw, &c); err != nil {
		return config{}, err
	}
	if c.BaseURL == "" {
		c.BaseURL = defaultBase
	}
	return c, nil
}

func saveConfig(c config) error {
	p, err := configPath()
	if err != nil {
		return err
	}
	raw, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(p, raw, 0o600)
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func die(msg string) {
	fmt.Fprintln(os.Stderr, "error: "+msg)
	os.Exit(1)
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil || h == "" {
		return "topha-agent"
	}
	return h
}
