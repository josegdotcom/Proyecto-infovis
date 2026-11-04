Write-Host "========================================"
Write-Host "     Instalador - Proyecto Infovis"
Write-Host "========================================"

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$VenvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$Requirements = Join-Path $PSScriptRoot "requirements.txt"

Write-Host "`n[1/5] Comprobando archivos..."

if (-not (Test-Path $Requirements)) {
    Write-Host "ERROR: No se encontro requirements.txt."
    exit 1
}

Write-Host "`n[2/5] Comprobando entorno virtual..."

$UsarExistente = $false

if (Test-Path $VenvPython) {
    $Version = & $VenvPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null

    if ($LASTEXITCODE -eq 0 -and $Version -in @("3.11", "3.12", "3.13")) {
        Write-Host "Entorno existente encontrado: Python $Version"
        $UsarExistente = $true
    }
}

$Candidatos = @()

if ($UsarExistente) {
    $Candidatos += [PSCustomObject]@{
        Version = $Version
        Ruta = $VenvPython
        Existente = $true
    }
}
else {
    Write-Host "`nBuscando instalaciones de Python..."

    $Launcher = Get-Command py -ErrorAction SilentlyContinue

    if (-not $Launcher) {
        Write-Host "ERROR: No se encontro el lanzador de Python (py)."
        Write-Host "Instala Python desde https://www.python.org/downloads/"
        exit 1
    }

    $VersionesPermitidas = @("3.13", "3.12", "3.11")
    $Instalaciones = & py -0p 2>$null

    foreach ($Linea in $Instalaciones) {
        if ($Linea -match '^\s*-V:(\d+\.\d+)\s+\*?\s*(.+?)\s*$') {
            $V = $Matches[1]
            $Ruta = $Matches[2].Trim()

            if ($V -in $VersionesPermitidas -and (Test-Path $Ruta)) {
                $Candidatos += [PSCustomObject]@{
                    Version = $V
                    Ruta = $Ruta
                    Existente = $false
                }
            }
        }
    }

    # Orden de preferencia
    $Candidatos = @(
        foreach ($V in $VersionesPermitidas) {
            $Candidatos | Where-Object { $_.Version -eq $V }
        }
    )

    if ($Candidatos.Count -eq 0) {
        Write-Host "ERROR: No se encontro Python 3.11, 3.12 o 3.13."
        Write-Host "Instala una version compatible desde https://www.python.org/downloads/"
        exit 1
    }
}

Write-Host "`n[3/5] Preparando entorno..."

$Respaldo = $null

if (-not $UsarExistente -and (Test-Path ".venv")) {
    $Respaldo = Join-Path $env:TEMP ("infovis-venv-respaldo-" + (Get-Date -Format "yyyyMMddHHmmss"))

    Write-Host "La carpeta .venv existente no es funcional."
    Write-Host "Conservando sus archivos en: $Respaldo"

    Move-Item ".venv" $Respaldo
}

$InstalacionExitosa = $false

foreach ($Candidato in $Candidatos) {

    Write-Host "`n----------------------------------------"
    Write-Host "Probando Python $($Candidato.Version)"
    Write-Host "----------------------------------------"

    if (-not $Candidato.Existente) {
        & $Candidato.Ruta -m venv .venv

        if ($LASTEXITCODE -ne 0) {
            Write-Host "No se pudo crear el entorno con esta version."
            if (Test-Path ".venv") {
                Remove-Item ".venv" -Recurse -Force
            }
            continue
        }
    }

    if (-not (Test-Path $VenvPython)) {
        Write-Host "No se encontro el interprete del entorno."
        if (Test-Path ".venv") {
            Remove-Item ".venv" -Recurse -Force
        }
        continue
    }

    Write-Host "`nActualizando pip..."

    & $VenvPython -m pip install --upgrade pip

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Fallo la actualizacion de pip."

        if ($Candidato.Existente) {
            break
        }

        Remove-Item ".venv" -Recurse -Force
        continue
    }

    Write-Host "`nInstalando dependencias..."

    & $VenvPython -m pip install -r $Requirements

    if ($LASTEXITCODE -ne 0) {
        Write-Host "La instalacion de dependencias fallo."

        if ($Candidato.Existente) {
            break
        }

        Remove-Item ".venv" -Recurse -Force
        continue
    }

    Write-Host "`nVerificando bibliotecas..."

    & $VenvPython -c "import tensorflow, keras, sklearn, fastapi; print('TensorFlow:', tensorflow.__version__); print('Keras:', keras.__version__); print('Scikit-learn:', sklearn.__version__); print('FastAPI:', fastapi.__version__)"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "La verificacion de bibliotecas fallo."

        if ($Candidato.Existente) {
            break
        }

        Remove-Item ".venv" -Recurse -Force
        continue
    }

    $InstalacionExitosa = $true
    break
}

if (-not $InstalacionExitosa) {

    Write-Host "`n========================================"
    Write-Host "       INSTALACION NO COMPLETADA"
    Write-Host "========================================"

    if (Test-Path ".venv") {
        Remove-Item ".venv" -Recurse -Force
    }

    if ($Respaldo -and (Test-Path $Respaldo)) {
        Move-Item $Respaldo ".venv"
        Write-Host "Se restauro el entorno anterior."
    }

    Write-Host "Revisa los errores anteriores."
    exit 1
}

if ($Respaldo -and (Test-Path $Respaldo)) {
    Remove-Item $Respaldo -Recurse -Force
}

Write-Host "`n========================================"
Write-Host "       INSTALACION COMPLETADA"
Write-Host "========================================"

Write-Host "`nPython utilizado:"
& $VenvPython --version