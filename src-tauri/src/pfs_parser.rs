use anyhow::{anyhow, Result};
use regex::Regex;
use serde_yaml::Value;

const HEADER: &str = "petalfly 1.0";

pub fn parse_document(source: &str) -> Result<Value> {
    let normalized = normalize(source)?;
    let (_, yaml_body) = normalized
        .split_once('\n')
        .ok_or_else(|| anyhow!("archivo vacío"))?;
    let value: Value = serde_yaml::from_str(&yaml_body)?;
    Ok(value)
}

pub fn validate_required(value: &Value) -> Result<()> {
    if value.get("meta").is_none() {
        return Err(anyhow!("meta es obligatorio"));
    }
    if value.get("request").is_none() {
        return Err(anyhow!("request es obligatorio"));
    }
    Ok(())
}

fn normalize(source: &str) -> Result<String> {
    let trimmed = source.replace("\r\n", "\n");
    if !trimmed.trim_start().starts_with(HEADER) {
        return Err(anyhow!("encabezado inválido, se esperaba {HEADER}"));
    }
    let mut result: Vec<String> = Vec::new();
    let mut in_docs = false;
    let mut indent = String::new();
    for line in trimmed.lines() {
        if !in_docs {
            let trimmed_line = line.trim();
            if trimmed_line.starts_with("docs:") && trimmed_line.contains("\"\"\"") {
                in_docs = true;
                indent = line
                    .chars()
                    .take_while(|c| c.is_whitespace())
                    .collect::<String>();
                result.push(format!("{indent}docs: |"));
            } else {
                result.push(line.to_string());
            }
        } else if line.trim() == "\"\"\"" {
            in_docs = false;
        } else {
            result.push(format!("{indent}  {}", line));
        }
    }
    Ok(result.join("\n"))
}

#[allow(dead_code)]
pub fn detect_variables(text: &str) -> Vec<String> {
    let regex = Regex::new(r"\{\{\s*([\w\.\-]+)\s*\}\}").expect("regex válida");
    regex
        .captures_iter(text)
        .filter_map(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        .collect()
}
