# run.ps1
# Helper script to run the backend locally with environment variables from .env

if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $name, $value = $line -split '=', 2
            if ($name -and $value) {
                $trimmedValue = $value.Trim()
                # Remove surrounding quotes if they exist
                if ($trimmedValue -match '^["''](.*)["'']$') {
                    $trimmedValue = $matches[1]
                }
                [System.Environment]::SetEnvironmentVariable($name.Trim(), $trimmedValue, [System.EnvironmentVariableTarget]::Process)
                Write-Host "Set $name"
            }
        }
    }
} else {
    Write-Warning ".env file not found. Ensure environment variables are set manually."
}

go run ./cmd/main.go
