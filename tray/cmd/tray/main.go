package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"fyne.io/systray"
	"github.com/scottconverse/patentforge/tray/internal/assets"
)

var version = "0.7.0-dev"

func main() {
	systray.Run(onReady, onExit)
}

func onReady() {
	// Set icon (PNG works on all platforms)
	systray.SetIcon(assets.IconPNG)
	systray.SetTitle("PatentForge")
	systray.SetTooltip("PatentForge — Starting...")

	// Menu items
	mOpen := systray.AddMenuItem("Open PatentForge", "Open in browser")
	mStatus := systray.AddMenuItem("Status: Starting...", "")
	mStatus.Disable()
	systray.AddSeparator()
	mLogs := systray.AddMenuItem("View Logs", "Open logs directory")
	mRestart := systray.AddMenuItem("Restart Services", "Restart all services")
	mAbout := systray.AddMenuItem(fmt.Sprintf("About PatentForge v%s", version), "")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Stop all services and exit")

	// Update status to Running (service management comes in Task 7)
	mStatus.SetTitle("Status: Running")
	systray.SetTooltip("PatentForge — Running")

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				if err := openBrowser("http://localhost:3000"); err != nil {
					fmt.Fprintf(os.Stderr, "Failed to open browser: %v\n", err)
				}
			case <-mLogs.ClickedCh:
				if err := openFileExplorer(getLogsDir()); err != nil {
					fmt.Fprintf(os.Stderr, "Failed to open logs directory: %v\n", err)
				}
			case <-mRestart.ClickedCh:
				// Service management implemented in Task 7
				mStatus.SetTitle("Status: Restarting...")
				mStatus.SetTitle("Status: Running")
			case <-mAbout.ClickedCh:
				if err := openBrowser("https://github.com/scottconverse/patentforge/releases"); err != nil {
					fmt.Fprintf(os.Stderr, "Failed to open browser: %v\n", err)
				}
			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func onExit() {
	// Cleanup implemented in Task 8
	fmt.Println("PatentForge shutting down...")
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}

func openFileExplorer(path string) error {
	if err := os.MkdirAll(path, 0755); err != nil {
		return err
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}

func getLogsDir() string {
	exe, err := os.Executable()
	if err != nil {
		if home, homeErr := os.UserHomeDir(); homeErr == nil {
			return filepath.Join(home, "PatentForge", "logs")
		}
		return "."
	}
	return filepath.Join(filepath.Dir(exe), "logs")
}
