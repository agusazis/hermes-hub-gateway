use tokio::time::{sleep, Duration};

pub async fn start_mcp_server() {
    println!("[MCP Hub] Unified MCP Bridge listener initialized.");
    loop {
        sleep(Duration::from_secs(60)).await;
    }
}
