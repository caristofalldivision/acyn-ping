//go:build !windows

package main

import (
	"fmt"
	"os"
	osexec "os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"syscall"
)

func installServiceWindows(exePath string) error {
	return fmt.Errorf("windows-only path called on non-windows")
}

func installServiceLinux(exePath string) error {
	u, err := user.Current()
	if err != nil {
		return err
	}
	if _, err := osexec.LookPath("systemctl"); err == nil {
		unitDir := filepath.Join(u.HomeDir, ".config", "systemd", "user")
		if err := os.MkdirAll(unitDir, 0o755); err != nil {
			return err
		}
		unit := fmt.Sprintf(`[Unit]
Description=Ping Agent

[Service]
ExecStart=%s run
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`, exePath)
		if err := os.WriteFile(filepath.Join(unitDir, "ping-agent.service"), []byte(unit), 0o644); err != nil {
			return err
		}
		_ = osexec.Command("systemctl", "--user", "daemon-reload").Run()
		if out, err := osexec.Command("systemctl", "--user", "enable", "--now", "ping-agent").CombinedOutput(); err != nil {
			fmt.Println("systemctl --user not usable (", strings.TrimSpace(string(out)), ") — falling back to nohup")
		} else {
			return nil
		}
	}
	return spawnNohup(exePath)
}

func installServiceDarwin(exePath string) error {
	u, err := user.Current()
	if err != nil {
		return err
	}
	plistDir := filepath.Join(u.HomeDir, "Library", "LaunchAgents")
	if err := os.MkdirAll(plistDir, 0o755); err != nil {
		return err
	}
	plistPath := filepath.Join(plistDir, "click.echoisp.ping-agent.plist")
	plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>click.echoisp.ping-agent</string>
  <key>ProgramArguments</key>
  <array><string>%s</string><string>run</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/ping-agent.log</string>
  <key>StandardErrorPath</key><string>/tmp/ping-agent.log</string>
</dict>
</plist>
`, exePath)
	if err := os.WriteFile(plistPath, []byte(plist), 0o644); err != nil {
		return err
	}
	_ = osexec.Command("launchctl", "unload", plistPath).Run()
	if out, err := osexec.Command("launchctl", "load", "-w", plistPath).CombinedOutput(); err != nil {
		fmt.Println("launchctl load failed (", strings.TrimSpace(string(out)), ") — falling back to nohup")
		return spawnNohup(exePath)
	}
	return nil
}

func spawnNohup(exePath string) error {
	logf, _ := os.OpenFile("/tmp/ping-agent.log", os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	cmd := osexec.Command(exePath, "run")
	if logf != nil {
		cmd.Stdout = logf
		cmd.Stderr = logf
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	_ = cmd.Process.Release()
	return nil
}
