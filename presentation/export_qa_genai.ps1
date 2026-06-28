# Export slides 19-35 (around the GenAI theory section) to JPG for QA
$BASE = "D:\mca\2nd semester\GEN AI\EL Project\AgroPrice-AI\presentation"
$src  = "$BASE\AgroPrice_AI_FINAL.pptx"
$dest = "$BASE\qa_genai"

if (-not (Test-Path $dest)) { New-Item -ItemType Directory $dest | Out-Null }

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
$prs = $ppt.Presentations.Open($src, $true, $false, $false)

Write-Host "Total slides: $($prs.Slides.Count)"

# Export slides 19 through 36 (the GenAI theory section + surrounding context)
for ($i = 19; $i -le 36; $i++) {
    if ($i -le $prs.Slides.Count) {
        $outPath = "$dest\Slide$i.JPG"
        $prs.Slides($i).Export($outPath, "JPG", 1280, 720)
        Write-Host "Exported slide $i"
    }
}

$prs.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
Write-Host "DONE: QA images saved to $dest"
