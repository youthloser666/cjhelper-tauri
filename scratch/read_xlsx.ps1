Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead("D:\WEB\PROJECT V2\db-new.xlsx")
$e = $z.GetEntry("xl/sharedStrings.xml")
$s = $e.Open()
$r = New-Object System.IO.StreamReader($s)
$t = $r.ReadToEnd()
$strings = @()
[regex]::Matches($t, "<si>(.*?)</si>") | ForEach-Object {
    $m = [regex]::Match($_.Value, "<t[^>]*>(.*?)</t>")
    if ($m.Success) { $strings += $m.Groups[1].Value } else { $strings += "" }
}
$z.Dispose()
$foundUntitled = $strings | Where-Object { $_ -match "untitled" }
Write-Output "Untitled in db-new.xlsx: $($foundUntitled.Count)"
if ($foundUntitled) { $foundUntitled | ForEach-Object { Write-Output " - $_" } }
Write-Output "Total shared strings in db-new: $($strings.Count)"
