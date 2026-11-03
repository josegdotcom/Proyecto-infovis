# comprobar Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python no esta instalado"
    exit 1
}

# crear entorno virtual
python -m venv .venv

# activar entorno
.\.venv\Scripts\Activate.ps1

# actualizar pip
python -m pip install --upgrade pip

# instalar dependencias
python -m pip install -r requirements.txt

Write-Host "Entorno preparado correctamente"