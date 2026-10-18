use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub default_hermes_url: String,
    pub default_mnemosyne_url: String,
    pub active_profile: String,
}
