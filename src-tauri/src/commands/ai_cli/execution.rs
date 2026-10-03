use super::resolution::ResolvedCommand;
#[cfg(target_os = "windows")]
use std::ffi::OsStr;
use tokio::process::Command;

#[cfg(target_os = "windows")]
pub(super) fn quote_windows_arg(value: &OsStr) -> String {
    let value = value.to_string_lossy();
    if !value.is_empty()
        && !value
            .chars()
            .any(|character| character.is_whitespace() || character == '"')
    {
        return value.into_owned();
    }

    let mut quoted = String::from("\"");
    let mut backslashes = 0;
    for character in value.chars() {
        if character == '\\' {
            backslashes += 1;
            continue;
        }
        if character == '"' {
            quoted.extend(std::iter::repeat('\\').take(backslashes * 2 + 1));
            quoted.push('"');
        } else {
            quoted.extend(std::iter::repeat('\\').take(backslashes));
            quoted.push(character);
        }
        backslashes = 0;
    }
    quoted.extend(std::iter::repeat('\\').take(backslashes * 2));
    quoted.push('"');
    quoted
}

pub(super) fn process_for(resolved: &ResolvedCommand, arguments: &[String]) -> Command {
    #[cfg(target_os = "windows")]
    if resolved.use_cmd_shell {
        let mut process = Command::new("cmd.exe");
        let mut command_line = quote_windows_arg(resolved.program.as_os_str());
        for argument in arguments {
            command_line.push(' ');
            command_line.push_str(&quote_windows_arg(OsStr::new(argument)));
        }
        return {
            process.arg("/D").arg("/S").arg("/C").arg(command_line);
            process
        };
    }

    let mut process = Command::new(&resolved.program);
    process.args(arguments);
    process
}
