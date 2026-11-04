Write-Host "========================================"
Write-Host "     Instalador - Proyecto Infovis"
Write-Host "========================================"

Set-Location $PSScriptRoot

Write-Host "`n[1/5] Buscando Python 3.11..."

$Python = $null

$Candidatos = @(
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:ProgramFiles\Python311\python.exe"
)

foreach ($Ruta in $Candidatos) {
    if (Test-Path $Ruta) {
        $Version = & $Ruta -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null

        if ($LASTEXITCODE -eq 0 -and $Version -eq "3.11") {
            $Python = $Ruta
            break
        }
    }
}

if (-not $Python) {
    $Launcher = Get-Command py -ErrorAction SilentlyContinue

    if ($Launcher) {
        $RutaDetectada = & py -3.11 -c "import sys; print(sys.executable)" 2>$null

        if ($LASTEXITCODE -eq 0 -and (Test-Path $RutaDetectada)) {
            $Version = & $RutaDetectada -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null

            if ($LASTEXITCODE -eq 0 -and $Version -eq "3.11") {
                $Python = $RutaDetectada
            }
        }
    }
}

if (-not $Python) {
    Write-Host "`nERROR: No se encontro una instalacion valida de Python 3.11."
    Write-Host "Instala Python 3.11 desde https://www.python.org/downloads/"
    exit 1
}

Write-Host "Python encontrado: $Python"
& $Python --version

Write-Host "`n[2/5] Comprobando archivos del proyecto..."

if (-not (Test-Path ".\requirements.txt")) {
    Write-Host "ERROR: No se encontro requirements.txt."
    exit 1
}

Write-Host "requirements.txt encontrado."

Write-Host "`n[3/5] Comprobando entorno virtual..."

$VenvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    $VenvVersion = & $VenvPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null

    if ($LASTEXITCODE -ne 0 -or $VenvVersion -ne "3.11") {
        Write-Host "El entorno existente no utiliza Python 3.11."
        Write-Host "Se eliminara para crear uno compatible..."

        Remove-Item ".\.venv" -Recurse -Force

        if (Test-Path ".\.venv") {
            Write-Host "ERROR: No se pudo eliminar el entorno anterior."
            exit 1
        }
    }
}

if (-not (Test-Path $VenvPython)) {
    Write-Host "Creando entorno virtual con Python 3.11..."

    & $Python -m venv .venv

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: No se pudo crear el entorno virtual."
        exit 1
    }
}
else {
    Write-Host "El entorno virtual existente utiliza Python 3.11."
}

if (-not (Test-Path $VenvPython)) {
    Write-Host "ERROR: No se encontro el Python del entorno virtual."
    exit 1
}

$VenvVersion = & $VenvPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"

if ($LASTEXITCODE -ne 0 -or $VenvVersion -ne "3.11") {
    Write-Host "ERROR: El entorno virtual no utiliza Python 3.11."
    exit 1
}

Write-Host "`n[4/5] Instalando dependencias..."

& $VenvPython -m pip install --upgrade pip

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudo actualizar pip."
    exit 1
}

& $VenvPython -m pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudieron instalar todas las dependencias."
    exit 1
}

Write-Host "`n[5/5] Verificando dependencias..."

& $VenvPython -c "import tensorflow, keras, sklearn, fastapi; print('TensorFlow:', tensorflow.__version__); print('Keras:', keras.__version__); print('Scikit-learn:', sklearn.__version__); print('FastAPI:', fastapi.__version__)"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Una o mas dependencias principales no funcionan."
    exit 1
}

Write-Host "`n========================================"
Write-Host "       INSTALACION COMPLETADA"
Write-Host "========================================"