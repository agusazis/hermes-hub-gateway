#[allow(dead_code)]
pub fn encrypt_credential(plain: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        Ok(format!("DPAPI_{}", plain))
    }
    #[cfg(not(windows))]
    {
        Ok(plain.to_string())
    }
}

#[allow(dead_code)]
pub fn decrypt_credential(cipher: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        Ok(cipher.replace("DPAPI_", ""))
    }
    #[cfg(not(windows))]
    {
        Ok(cipher.to_string())
    }
}
