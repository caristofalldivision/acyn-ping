// Ping Agent v0.1
//
// Single-file Go program that:
//   1. Pairs once with `ping-agent pair <code>`  -> stores agent_id + secret in ~/.ping/agent.json
//   2. Polls Ping for pending jobs and runs them against MikroTik routers
//
// Drivers: SSH (default, works on RouterOS v6 + v7) and REST (RouterOS v7.1+).
// Job kinds handled: fetch_config, apply_script, take_backup, restore_backup, wizard_hotspot.
//
// Build:   go build -o ping-agent .
// Run:     ./ping-agent pair ABC123
//          ./ping-agent run
//
// No external deps beyond the Go stdlib + golang.org/x/crypto/ssh.

package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"os/user"
	"path/filepath"
	"runtime"
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

type portalFile struct {
	Name      string `json:"name"`
	ContentB64 string `json:"content_b64"`
}
type portalPayload struct {
	HotspotProfile string       `json:"hotspot_profile"` // e.g. "hsprof1"
	HtmlDir        string       `json:"html_dir"`        // e.g. "hotspot"
	Files          []portalFile `json:"files"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: ping-agent <pair <code> | run | status | doctor [--router HOST --user U --password P [--port 22]]>")
		os.Exit(1)
	}
	switch os.Args[1] {
	case "pair":
		if len(os.Args) < 3 {
			die("usage: ping-agent pair <code>")
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
	case "doctor":
		// Optional MikroTik reachability test: ping-agent doctor --router H --user U --password P [--port 22]
		if len(os.Args) > 2 {
			runRouterDoctor(os.Args[2:])
			return
		}
		runDoctor()
	default:
		die("unknown command: " + os.Args[1])
	}
}

// runRouterDoctor SSHs into a MikroTik with the supplied credentials and
// runs `/system resource print` so the operator can confirm reachability
// *before* trying to add the device to Ping.
func runRouterDoctor(args []string) {
	host, user, pass := "", "", ""
	port := 22
	for i := 0; i < len(args); i++ {
		a := args[i]
		next := ""
		if i+1 < len(args) {
			next = args[i+1]
		}
		switch a {
		case "--router", "-h":
			host = next
			i++
		case "--user", "-u":
			user = next
			i++
		case "--password", "-p":
			pass = next
			i++
		case "--port":
			fmt.Sscanf(next, "%d", &port)
			i++
		}
	}
	if host == "" || user == "" || pass == "" {
		die("usage: ping-agent doctor --router <host> --user <user> --password <pw> [--port 22]")
	}
	fmt.Printf("== ping-agent router doctor ==\n")
	fmt.Printf("[ .. ] dialing ssh %s@%s:%d\n", user, host, port)
	d := device{Host: host, Port: port, Username: user, Password: pass, ConnectionMethod: "ssh"}
	exec, err := newSSH(d)
	if err != nil {
		fmt.Println("[FAIL] connect:", friendlySSHError(err, host, port))
		os.Exit(1)
	}
	defer exec.close()
	fmt.Println("[ OK ] SSH connected")
	out, err := exec.run("/system resource print")
	if err != nil {
		fmt.Println("[FAIL] running /system resource print:", err)
		os.Exit(1)
	}
	model := extractField(out, "board-name")
	ver := extractField(out, "version")
	fmt.Printf("[ OK ] RouterOS %s · %s\n", ver, model)
	fmt.Println("router is reachable and credentials work — safe to add it in Ping → Device Vault.")
}

// friendlySSHError converts golang.org/x/crypto/ssh errors into actionable hints.
func friendlySSHError(err error, host string, port int) string {
	s := err.Error()
	low := strings.ToLower(s)
	switch {
	case strings.Contains(low, "unable to authenticate"), strings.Contains(low, "no supported methods"):
		return s + "  (wrong username or password — check the MikroTik user)"
	case strings.Contains(low, "connection refused"):
		return fmt.Sprintf("%s  (SSH disabled or wrong port — in Winbox run: /ip service enable ssh; /ip service set ssh port=%d)", s, port)
	case strings.Contains(low, "i/o timeout"), strings.Contains(low, "deadline exceeded"):
		return s + fmt.Sprintf("  (no route to %s:%d — firewall, VPN, or wrong IP)", host, port)
	case strings.Contains(low, "no such host"):
		return s + "  (DNS lookup failed — use the router's IP address)"
	}
	return s
}

func runDoctor() {
	fmt.Println("== ping-agent doctor ==")
	c, err := loadConfig()
	if err != nil {
		fmt.Println("[FAIL] pairing config:", err)
		fmt.Println("       fix: run 'ping-agent pair <CODE>' (get code from Ping → Device Vault)")
		return
	}
	fmt.Printf("[ OK ] pairing config loaded · agent_id=%s\n", c.AgentID)
	fmt.Printf("[ .. ] backend reachability: %s\n", c.BaseURL)
	req, _ := http.NewRequest("GET", c.BaseURL+"/device-jobs/pending", nil)
	req.Header.Set("X-Agent-Id", c.AgentID)
	req.Header.Set("X-Agent-Secret", c.AgentSecret)
	resp, err := httpClient().Do(req)
	if err != nil {
		fmt.Println("[FAIL] backend call:", err)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	switch resp.StatusCode {
	case 200:
		fmt.Println("[ OK ] backend accepted agent credentials")
	case 401:
		fmt.Println("[FAIL] backend rejected agent credentials (401). Re-pair the agent.")
		fmt.Println("       body:", string(body))
	default:
		fmt.Printf("[WARN] backend returned %d: %s\n", resp.StatusCode, body)
	}
	fmt.Println("done.")
}

// ---------------- pairing ----------------

func doPair(code string) error {
	base := envOr("PING_BASE_URL", defaultBase)
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
		die("not paired yet — run: ping-agent pair <code>")
	}
	fmt.Printf("ping-agent online · agent_id=%s · polling %s\n", c.AgentID, c.BaseURL)

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
			fmt.Println("ping-agent stopped")
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

	exec, err := connectDeviceWithRetry(j.Devices, logf)
	if err != nil {
		logf("ERROR connecting: " + err.Error())
		reportDeviceStatus(c, j.Devices.ID, false, "", "")
		sendResult(c, j.ID, "failed", "", err.Error())
		return
	}
	defer exec.close()
	logf("connected via " + j.Devices.ConnectionMethod)

	// Best-effort: report device online + identify model/version
	go func() {
		ver, _ := exec.run("/system resource print")
		model := extractField(ver, "board-name")
		rosVer := extractField(ver, "version")
		reportDeviceStatus(c, j.Devices.ID, true, rosVer, model)
	}()

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
		name := "ping-" + time.Now().Format("20060102-150405")
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
	case "deploy_portal":
		runDeployPortal(c, j, exec, logf)
	default:
		sendResult(c, j.ID, "failed", "", "unknown kind: "+j.Kind)
	}
}

func runDeployPortal(c config, j job, exec deviceExec, logf func(string)) {
	if j.ScriptContent == nil {
		sendResult(c, j.ID, "failed", "", "no portal payload")
		return
	}
	var p portalPayload
	if err := json.Unmarshal([]byte(*j.ScriptContent), &p); err != nil {
		sendResult(c, j.ID, "failed", "", "bad payload: "+err.Error())
		return
	}
	if p.HtmlDir == "" { p.HtmlDir = "hotspot" }
	if p.HotspotProfile == "" { p.HotspotProfile = "hsprof1" }
	var out bytes.Buffer
	for _, f := range p.Files {
		data, err := base64.StdEncoding.DecodeString(f.ContentB64)
		if err != nil { sendResult(c, j.ID, "failed", out.String(), "bad b64: "+err.Error()); return }
		// Use RouterOS /file/add for text files (works on REST + SSH). Inline content via escaped string.
		safe := strings.ReplaceAll(string(data), "\"", "\\\"")
		cmd := fmt.Sprintf(`/file add name=%s/%s contents="%s"`, p.HtmlDir, f.Name, safe)
		logf("upload " + f.Name + " (" + fmt.Sprintf("%d", len(data)) + " bytes)")
		o, err := exec.run(cmd)
		out.WriteString(o + "\n")
		if err != nil { sendResult(c, j.ID, "failed", out.String(), err.Error()); return }
	}
	o, err := exec.run(fmt.Sprintf(`/ip hotspot profile set [find name=%s] html-directory=%s`, p.HotspotProfile, p.HtmlDir))
	out.WriteString(o + "\n")
	if err != nil { sendResult(c, j.ID, "failed", out.String(), err.Error()); return }
	sendResult(c, j.ID, "success", out.String(), "")
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

		// After backup step, wait until the .backup file actually exists on disk
		if s.ID == "backup" && w.Plan.BackupName != "" {
			if err := waitForBackup(exec, w.Plan.BackupName, logf); err != nil {
				logf("BACKUP NOT WRITTEN: " + err.Error() + " — aborting before any writes")
				sendResult(c, j.ID, "failed", fullOut.String(), "backup did not materialize: "+err.Error())
				return
			}
			logf("backup confirmed on disk: " + w.Plan.BackupName + ".backup")
		}

		// After preflight, fail-fast if the read tells us the network is unsafe
		if s.ID == "preflight" {
			if reason := preflightReject(stepOut.String()); reason != "" {
				logf("PREFLIGHT REJECT: " + reason + " — aborting")
				sendResult(c, j.ID, "failed", fullOut.String(), "preflight: "+reason)
				return
			}
		}

		if s.Kind == "write" && len(s.RollbackCommands) > 0 {
			appliedRollbacks = append([][]string{s.RollbackCommands}, appliedRollbacks...)
		}
	}
	sendResult(c, j.ID, "success", fullOut.String(), "")
}

func waitForBackup(exec deviceExec, name string, logf func(string)) error {
	cmd := `/file print where name="` + name + `.backup"`
	for i := 0; i < 10; i++ {
		out, _ := exec.run(cmd)
		if strings.Contains(out, name+".backup") {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return errors.New("timed out waiting for " + name + ".backup")
}

func preflightReject(out string) string {
	low := strings.ToLower(out)
	// MikroTik prints a header even with zero matches; we look for the absence
	// of any data rows for the interface query, which is the first command.
	if strings.Contains(low, "no such item") {
		return "interface or address not found"
	}
	return ""
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

// connectDeviceWithRetry retries up to 3 times with exponential backoff.
func connectDeviceWithRetry(d device, logf func(string)) (deviceExec, error) {
	var lastErr error
	delays := []time.Duration{1 * time.Second, 3 * time.Second, 9 * time.Second}
	for i, delay := range delays {
		if i > 0 {
			logf(fmt.Sprintf("retry %d/%d after %s...", i+1, len(delays), delay))
			time.Sleep(delay)
		}
		x, err := connectDevice(d)
		if err == nil {
			return x, nil
		}
		lastErr = err
		logf("connect attempt failed: " + err.Error())
	}
	return nil, lastErr
}

// extractField returns the value after `key:` from a RouterOS print line.
func extractField(out, key string) string {
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, key+":") {
			return strings.TrimSpace(strings.TrimPrefix(line, key+":"))
		}
	}
	return ""
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
		Auth:            []ssh.AuthMethod{ssh.Password(d.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         15 * time.Second,
	}
	c, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", d.Host, port), cfg)
	if err != nil {
		return nil, fmt.Errorf("%s", friendlySSHError(err, d.Host, port))
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
	// Translate a RouterOS CLI line into REST.
	//
	//   /ip address add address=1.1.1.1/24 interface=ether1
	//      → PUT /rest/ip/address  body {address:"...", interface:"..."}
	//   /ip hotspot print
	//      → GET /rest/ip/hotspot
	//   /ip address remove [find comment="x"]
	//      → POST /rest/ip/address/remove  body {".query": ["comment=x"]}
	//   /ip hotspot user profile add name=foo rate-limit=5M/5M
	//      → PUT /rest/ip/hotspot/user/profile  body {name:"foo", ...}
	//
	// The trick is that the action keyword (add/print/set/remove) can appear
	// anywhere after the leading path, not always at parts[1].
	parts := tokenize(cmd)
	if len(parts) == 0 {
		return "", nil
	}
	// Find the action token (first non-path word that is also not a key=value).
	actionIdx := -1
	for i := 1; i < len(parts); i++ {
		switch parts[i] {
		case "add", "print", "remove", "set", "enable", "disable":
			actionIdx = i
			break
		}
		if actionIdx != -1 {
			break
		}
	}
	verb := "POST"
	pathParts := []string{strings.TrimPrefix(parts[0], "/")}
	argStart := len(parts)
	if actionIdx > 0 {
		// path is parts[0..actionIdx-1] joined with /
		pathParts = []string{strings.TrimPrefix(parts[0], "/")}
		pathParts = append(pathParts, parts[1:actionIdx]...)
		switch parts[actionIdx] {
		case "add":
			verb = "PUT"
		case "print":
			verb = "GET"
		case "remove":
			verb = "POST"
			pathParts = append(pathParts, "remove")
		case "set":
			verb = "PATCH"
		case "enable":
			verb = "POST"
			pathParts = append(pathParts, "enable")
		case "disable":
			verb = "POST"
			pathParts = append(pathParts, "disable")
		}
		argStart = actionIdx + 1
	} else {
		// No action keyword (rare): treat as GET
		verb = "GET"
		pathParts = append(pathParts, parts[1:]...)
	}
	body := map[string]string{}
	for _, p := range parts[argStart:] {
		if strings.HasPrefix(p, "[") || strings.HasPrefix(p, "where") {
			continue // bracket/where queries unsupported via REST in v0.1
		}
		if i := strings.Index(p, "="); i > 0 {
			body[p[:i]] = strings.Trim(p[i+1:], `"`)
		}
	}
	bb, _ := json.Marshal(body)
	port := r.d.Port
	if port == 0 {
		port = 443
	}
	path := strings.Join(pathParts, "/")
	url := fmt.Sprintf("https://%s:%d/rest/%s", r.d.Host, port, path)
	var reqBody io.Reader
	if verb != "GET" && len(body) > 0 {
		reqBody = bytes.NewReader(bb)
	}
	req, _ := http.NewRequest(verb, url, reqBody)
	req.SetBasicAuth(r.d.Username, r.d.Password)
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

func reportDeviceStatus(c config, deviceID string, online bool, version, model string) {
	if deviceID == "" {
		return
	}
	body, _ := json.Marshal(map[string]any{
		"device_id":         deviceID,
		"online":            online,
		"routeros_version":  version,
		"model":             model,
	})
	req, _ := http.NewRequest("POST", c.BaseURL+"/device-jobs/device-status", bytes.NewReader(body))
	req.Header.Set("X-Agent-Id", c.AgentID)
	req.Header.Set("X-Agent-Secret", c.AgentSecret)
	req.Header.Set("Content-Type", "application/json")
	if resp, err := httpClient().Do(req); err == nil {
		resp.Body.Close()
	}
}

// ---------------- ping API helpers ----------------

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
	dir := filepath.Join(u.HomeDir, ".ping")
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
		return config{}, errors.New("not paired — run: ping-agent pair <code>")
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
		return "ping-agent"
	}
	return h
}
