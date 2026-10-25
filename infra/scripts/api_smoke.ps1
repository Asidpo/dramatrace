# DramaTrace PocketBase 后端冒烟测试
# 用法: pwsh -File api_smoke.ps1 [-Base http://127.0.0.1:8090] [-Email admin@dramatrace.local] [-Pass changeme123]
param(
  [string]$Base = 'http://127.0.0.1:8090',
  [string]$Email = 'admin@dramatrace.local',
  [string]$Pass = 'changeme123'
)
$ErrorActionPreference = 'Stop'
$ok = 0; $fail = 0
function Check($name, $okFlag, $detail = '') {
  if ($okFlag) { $script:ok++; Write-Output "PASS  $name" }
  else { $script:fail++; Write-Output "FAIL  $name  $detail" }
}

# 1. 登录
$login = Invoke-RestMethod -Method Post -Uri "$Base/api/collections/_superusers/auth-with-password" -ContentType 'application/json' -Body (@{ identity = $Email; password = $Pass } | ConvertTo-Json)
$token = $login.token
Check 'superuser login' ($null -ne $token)
$h = @{ Authorization = $token }

# 2. 建剧
$showBody = @{ name = '测试剧'; tmdb_id = 999999; source = 'manual'; total_seasons = 1 } | ConvertTo-Json
$show = Invoke-RestMethod -Method Post -Uri "$Base/api/collections/shows/records" -Headers $h -ContentType 'application/json' -Body $showBody
Check 'create show' ($null -ne $show.id)
$showId = $show.id

# 3. 建进度 S1E1
$now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss.fffZ')
$p1 = @{ show = $showId; season_number = 1; episode_number = 1; position_seconds = 120; device = 'web'; watched_at = $now; source = 'manual'; manually_edited = $false } | ConvertTo-Json
$prog = Invoke-RestMethod -Method Post -Uri "$Base/api/collections/progress/records" -Headers $h -ContentType 'application/json' -Body $p1
Check 'create progress' ($null -ne $prog.id)
$progId = $prog.id

# 4. 建进度后 history_log 应有 create 流水
$logs = Invoke-RestMethod -Method Get -Uri "$Base/api/collections/history_log/records?perPage=200" -Headers $h
Check 'history_log on create' (($logs.items | Where-Object { $_.progress -eq $progId }).Count -gt 0)
$logCountBefore = ($logs.items | Where-Object { $_.progress -eq $progId }).Count

# 5. 更新进度（position_seconds 120→300）→ 应有 update 流水
$p2 = @{ position_seconds = 300 } | ConvertTo-Json
$prog2 = Invoke-RestMethod -Method Patch -Uri "$Base/api/collections/progress/records/$progId" -Headers $h -ContentType 'application/json' -Body $p2
Check 'update progress' ($prog2.position_seconds -eq 300)
$logs2 = Invoke-RestMethod -Method Get -Uri "$Base/api/collections/history_log/records?perPage=200" -Headers $h
$logCountAfter = ($logs2.items | Where-Object { $_.progress -eq $progId }).Count
Check 'history_log on update' ($logCountAfter -gt $logCountBefore)

# 6. 去重：同 show/season/ep 再建 → 应 400
$dupErr = $null
try {
  Invoke-RestMethod -Method Post -Uri "$Base/api/collections/progress/records" -Headers $h -ContentType 'application/json' -Body $p1 | Out-Null
} catch { $dupErr = $_.Exception.Response.StatusCode.value__ }
Check 'unique index dedup' ($dupErr -eq 400) "got=$dupErr"

# 7. 手动保护：manually_edited=true 后再改 false → 应 403
$p3 = @{ manually_edited = $true } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$Base/api/collections/progress/records/$progId" -Headers $h -ContentType 'application/json' -Body $p3 | Out-Null
$guardErr = $null
try {
  $p4 = @{ manually_edited = $false } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri "$Base/api/collections/progress/records/$progId" -Headers $h -ContentType 'application/json' -Body $p4 | Out-Null
} catch { $guardErr = $_.Exception.Response.StatusCode.value__ }
Check 'manual flag guard' ($guardErr -eq 403) "got=$guardErr"

# 8. pending confirmed 且目标已手动编辑 → 应 403
$pdBody = @{ show = $showId; source_plugin = 'smoke'; dedup_key = "smoke-$showId-1-1"; match_season = 1; match_episode = 1; status = 'confirmed' } | ConvertTo-Json
$pdErr = $null
try {
  Invoke-RestMethod -Method Post -Uri "$Base/api/collections/pending_records/records" -Headers $h -ContentType 'application/json' -Body $pdBody | Out-Null
} catch { $pdErr = $_.Exception.Response.StatusCode.value__ }
Check 'pending confirm guard' ($pdErr -eq 403) "got=$pdErr"

# 9. 清理测试数据（级联删除）
Invoke-RestMethod -Method Delete -Uri "$Base/api/collections/shows/records/$showId" -Headers $h | Out-Null
$progAfter = Invoke-RestMethod -Method Get -Uri "$Base/api/collections/progress/records?filter=(show%3D%27$showId%27)" -Headers $h
$logsAfter = Invoke-RestMethod -Method Get -Uri "$Base/api/collections/history_log/records?perPage=200" -Headers $h
Check 'cascade delete progress' ($progAfter.totalItems -eq 0)
$rem = ($logsAfter.items | Where-Object { $_.progress -eq $progId }).Count
Check 'cascade delete history_log' ($rem -eq 0)

Write-Output "---"
Write-Output "PASS=$ok FAIL=$fail"
