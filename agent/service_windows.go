//go:build windows

package main

import (
	"fmt"
	osexec "os/exec"
	"syscall"
)

func installServiceWindows(exePath string) error {
	tr := fmt.Sprintf(`"%s" run`, exePath)
	cmd := osexec.Command("schtasks.exe", "/Create", "/TN", "Ping Agent",
		"/SC", "ONLOGON", "/TR", tr, "/RL", "LIMITED", "/F")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("schtasks failed: %v: %s", err, string(out))
	}
	start := osexec.Command(exePath, "run")
	start.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000008 | 0x00000200} // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
	if err := start.Start(); err != nil {
		return fmt.Errorf("start failed: %w", err)
	}
	_ = start.Process.Release()
	return nil
}

func installServiceLinux(exePath string) error { return fmt.Errorf("not supported on windows") }
func installServiceDarwin(exePath string) error { return fmt.Errorf("not supported on windows") }
func spawnNohup(exePath string) error           { return fmt.Errorf("not supported on windows") }
