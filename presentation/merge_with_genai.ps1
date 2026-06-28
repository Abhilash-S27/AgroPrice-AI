# Merge all 5 sections into AgroPrice_AI_FINAL.pptx
# Order: 1_10 (10 slides) + 11_19 (9) + GenAI_Theory (15) + 20_29 (10) + 30_39 (10) = 54 slides

$BASE = "D:\mca\2nd semester\GEN AI\EL Project\AgroPrice-AI\presentation"

$files = @(
    "$BASE\AgroPrice_AI_Slides_1_10.pptx",
    "$BASE\AgroPrice_AI_Slides_11_19.pptx",
    "$BASE\AgroPrice_AI_GenAI_Theory.pptx",
    "$BASE\AgroPrice_AI_Slides_20_29.pptx",
    "$BASE\AgroPrice_AI_Slides_30_39.pptx"
)
$output = "$BASE\AgroPrice_AI_FINAL.pptx"

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue

Write-Host "Opening base: $($files[0])"
$prs = $ppt.Presentations.Open($files[0], $false, $false, $true)
Write-Host "  Slides: $($prs.Slides.Count)"

for ($i = 1; $i -lt $files.Count; $i++) {
    $src = $files[$i]
    Write-Host "Inserting: $src"
    $insertAfter = $prs.Slides.Count
    $prs.Slides.InsertFromFile($src, $insertAfter)
    Write-Host "  Total slides now: $($prs.Slides.Count)"
}

Write-Host "Saving to: $output"
if (Test-Path $output) { Remove-Item $output -Force }
$prs.SaveAs($output)
$prs.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
Write-Host "DONE: $($prs.Slides.Count) slides saved"
