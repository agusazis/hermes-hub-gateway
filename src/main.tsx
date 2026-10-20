import React, { Component, ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error caught by GlobalErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "32px",
          backgroundColor: "#090d16",
          color: "#f8fafc",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <div style={{
            maxWidth: "720px",
            width: "100%",
            backgroundColor: "#0f172a",
            border: "1px solid #ef4444",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <span style={{ fontSize: "24px" }}>⚠️</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", color: "#f87171", fontWeight: "bold" }}>
                  HERMES HUB GATEWAY - RUNTIME EXCEPTION
                </h2>
                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                  Aplikasi mencegah layar putih (white screen crash). Detail kesalahan terdeteksi di bawah:
                </p>
              </div>
            </div>
            
            <div style={{
              backgroundColor: "#020617",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              color: "#fca5a5",
              fontSize: "13px",
              lineHeight: "1.5",
              marginBottom: "16px",
              wordBreak: "break-word"
            }}>
              <b>Error:</b> {this.state.error?.message || "Unknown Runtime Error"}
            </div>

            {this.state.error?.stack && (
              <pre style={{
                backgroundColor: "#020617",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #1e293b",
                color: "#64748b",
                fontSize: "11px",
                maxHeight: "180px",
                overflowY: "auto",
                whiteSpace: "pre-wrap"
              }}>
                {this.state.error.stack}
              </pre>
            )}

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Muat Ulang Aplikasi (Reload)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
);
