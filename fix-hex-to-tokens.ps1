# fix-hex-to-tokens.ps1
# Script de correction automatique DT-001 : remplace hex par tokens Tailwind
# Usage: .\fix-hex-to-tokens.ps1

$repo = Get-Location

Write-Host "=== Correction DT-001 : Hex → Tokens CPMSL ===" -ForegroundColor Cyan
Write-Host ""

# Fichiers à corriger (les 3 modals restants DT-001)
$files = @(
    "components\school\add-subject-child-modal.tsx",
    "components\school\create-academic-year-modal-v2.tsx",
    "components\school\class-statistics.tsx"
)

# Mapping hex → tokens Tailwind
$replacements = @{
    # Primary
    'focus:border-\[#5A7085\]' = 'focus-visible:border-primary-500'
    'focus:ring-\[#5A7085\]' = 'focus-visible:ring-primary-500/40'
    'hover:bg-\[#243D5A\]' = 'hover:bg-primary-700'
    'bg-\[#2C4A6E\]' = 'bg-primary-700'
    'bg-\[#5A7085\]' = 'bg-primary-500'
    'border-\[#5A7085\]' = 'border-primary-500'
    'text-\[#5A7085\]' = 'text-primary-500'
    
    # Neutral
    "border: '1px solid #D1CECC'" = "className='border border-neutral-300'"
    "border: '1px solid #E8E6E3'" = "className='border border-neutral-200'"
    "color: '#1E1A17'" = "className='text-neutral-900'"
    "color: '#5C5955'" = "className='text-neutral-600'"
    "color: '#78756F'" = "className='text-neutral-500'"
    "backgroundColor: '#FFFFFF'" = "className='bg-white'"
    'bg-\[#9CA3AF\]' = 'bg-neutral-400'
    'text-\[#bebbb4\]' = 'text-neutral-300'
    'border-\[#bebbb4\]' = 'border-neutral-300'
    
    # Error
    "color: '#C84A3D'" = "className='text-error'"
    "color: '#991B1B'" = "className='text-error'"
    'hover:bg-\[#991B1B\]' = 'hover:bg-error/90'
    'bg-\[#B91C1C\]' = 'bg-error'
    
    # Secondary
    "backgroundColor: '#FAF8F3'" = "className='bg-secondary-50'"
    "backgroundColor: '#F0EDE8'" = "className='bg-secondary-100'"
    'bg-\[#f7f7f6\]' = 'bg-neutral-50'
}

$totalFixed = 0

foreach ($file in $files) {
    $path = Join-Path $repo $file
    
    if (Test-Path $path) {
        Write-Host "Traitement : $file" -ForegroundColor Yellow
        $content = Get-Content $path -Raw
        $originalContent = $content
        
        foreach ($hex in $replacements.Keys) {
            $token = $replacements[$hex]
            $content = $content -replace [regex]::Escape($hex), $token
        }
        
        # Ajouter focus-visible:ring-2 si manquant
        $content = $content -replace 'focus-visible:border-primary-500(?! focus-visible:ring)', 'focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/40'
        
        if ($content -ne $originalContent) {
            Set-Content -Path $path -Value $content -NoNewline
            $totalFixed++
            Write-Host "  ✓ Corrigé" -ForegroundColor Green
        } else {
            Write-Host "  - Aucun changement" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ✗ Fichier introuvable" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Cyan
Write-Host "Fichiers corrigés : $totalFixed/$($files.Count)" -ForegroundColor Green
Write-Host ""
Write-Host "Vérification :"
Write-Host "  git diff components/school/"
