Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
Write-Host "█        A.V.A.T.A.R. Version Update Installer - STEP 1/2           █" -ForegroundColor DarkMagenta
Write-Host "█                        Windows installer                          █" -ForegroundColor DarkMagenta
Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
#■ A.V.A.T.A.R 29/10/2024

function CheckDependencies {
    Write-Host "> Checking dependencies..." -ForegroundColor Yellow
    # Check if npm is installed
    if (-not (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)) {
        Write-Host "npm is not installed. Please install Node.js and npm to continue." -ForegroundColor Green
        Stop-Transcript
        Exit 1
    }

    # Check if PowerShell version is sufficient
    if ($PSVersionTable.PSVersion -lt [Version]"7.0") {
        Write-Host "PowerShell version 7.0 or higher is required." -ForegroundColor Red
        Write-Host "Please, set the PowerShell executable field in the settings." -ForegroundColor Red
        Stop-Transcript
        Exit 1
    }
}

Start-Sleep -Seconds 3

$ErrorActionPreference = "Ignore"

# Keep new version by filename
$app_name = $MyInvocation.MyCommand.Name
$version = $app_name.Substring(0, ($app_name.Length -6))

if (Test-Path ./update-$version-step1.log -PathType Leaf) {
    Remove-Item ./update-$version-step1.log -Force
}

$ErrorActionPreference = "Stop"

Start-Transcript -path ./update-$version-step1.log -append

CheckDependencies

Write-Host "> New version: " -NoNewline -ForegroundColor DarkMagenta 
Write-Host "$version" -ForegroundColor DarkRed

# Get Client URL from property
$properties = Get-Content ../core/Avatar.prop -Encoding utf8 | ConvertFrom-Json
$property = $properties.repository
$url = "https://github.com/"+$property+"/archive/master.zip"

# Download master package
Write-Host "> Downloading client master package from GitHub" -NoNewline -ForegroundColor DarkMagenta
Invoke-WebRequest -Uri $url -OutFile ./A.V.A.T.A.R-Client-master.zip
Write-Host " done" -ForegroundColor Green
Start-Sleep -Seconds 1

# Unzip master package
if (Test-Path ./newVersion-$version) {
    Write-Host "> Removing old existing client master package" -NoNewline -ForegroundColor DarkMagenta
    Remove-Item ./newVersion-$version -Recurse -Force
    Write-Host " done" -ForegroundColor Green
}
Write-Host "> Extracting client master package" -NoNewline -ForegroundColor DarkMagenta
Expand-Archive -LiteralPath ./A.V.A.T.A.R-Client-master.zip -DestinationPath ./newVersion-$version -Force
Write-Host " done" -ForegroundColor Green
Start-Sleep -Seconds 1

# Set location
$current_location = Get-Location
$package = "$current_location/newVersion-$version/A.V.A.T.A.R-Client-master/update/$version"
Set-Location -Path $package

# Test version type
$installType = $null
Write-Host "> Update type: " -NoNewline -ForegroundColor DarkMagenta 
foreach($line in Get-Content "./README.txt"){
    If ($line -like "*new version*") {
        Write-Host "New client executable version" -ForegroundColor DarkRed
        $installType = "exe"
    } elseif ($line -like "*requires packages*") {
        Write-Host "New packages in node_modules directory" -ForegroundColor DarkMagenta
        $installType = "module"
    } elseif ($line -like "*files to be copied*") {
        Write-Host "Files only" -ForegroundColor DarkRed
        $installType = "file"
    }
}

if ($null -eq $installType) {
    Write-Error "Enable to find the installation type. Exit"
    Stop-Transcript
    exit
}

# perform installation for exe and module only
If (($installType -eq "exe") -or ($installType -eq "module")) {

    Write-Host "> Electron version: " -NoNewline -ForegroundColor DarkMagenta 
    $json_package = Get-Content ./package.json -Encoding utf8 | ConvertFrom-Json
    $electron_version = $json_package.devDependencies.electron
    if ($null -eq $electron_version ) {
        Write-Error "Enable to find the Electron version in the package.json. Exit"
        Stop-Transcript
        exit
    } else {
       # $electron_version = $electron_version.Substring(1, $electron_version.Length-1)
        Write-Host $electron_version -ForegroundColor DarkRed
    }

    If ($installType -eq "exe") {
        Write-Host "> Installing Electron packager, please wait..." -ForegroundColor DarkMagenta
        start-process -FilePath "npm.cmd" -ArgumentList "install", "--save-dev @electron/packager" -NoNewWindow -workingdirectory . -Wait 
        Write-Host "Electron packager installed" -ForegroundColor Green
        Start-Sleep -Seconds 1
        Write-Host "> Creating a new A.V.A.T.A.R client application, please wait..." -ForegroundColor DarkMagenta
        start-process -FilePath "npx.cmd" -ArgumentList "electron-packager", ".", "--electron-version=$electron_version", "--icon=./avatar.ico", "--out=./output" -NoNewWindow -workingdirectory . -Wait
        Write-Host "A.V.A.T.A.R application created" -ForegroundColor Green

         # get platform
         $output = Get-ChildItem -Path ./output
         foreach ($MySubFolder in $output) {
             $output_platform = $MySubFolder.name
         }
 
         if ($null -eq $output_platform ) {
             Write-Error "Enable to find the application output directory. Exit"
             Stop-Transcript
             exit
         }
        $package = "$package/output/$output_platform"
        Start-Sleep -Seconds 1 
    } else {
        Write-Host "> Installing node_modules packages, please wait..." -ForegroundColor DarkMagenta
        start-process -FilePath "npm.cmd" -ArgumentList "install" -NoNewWindow -workingdirectory . -Wait
        Write-Host "Node_modules packages installed" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
} 

Set-Location -Path $current_location

$last_dash = $app_name.LastIndexOf("-")
$last_point = $app_name.LastIndexOf(".")
$type_install = $app_name.Substring($last_dash+1, $last_point-$last_dash-1)

# Create a Zip with update version files
Write-Host "> Creating ZIP file, please await... " -ForegroundColor DarkMagenta
if ($type_install -eq '0') {
    if (Test-Path -Path "./download") {
        Remove-Item ./download/* -Recurse -Force
    } else {
        New-Item -Path $current_location -Name "download" -ItemType "directory"
    }
    [Reflection.Assembly]::LoadWithPartialName("System.IO.Compression.FileSystem")
    [System.IO.Compression.ZipFile]::CreateFromDirectory("$package", "$current_location/download/newVersion-$version.zip")
    Start-Sleep -Seconds 1
} else {
    [Reflection.Assembly]::LoadWithPartialName("System.IO.Compression.FileSystem")
    [System.IO.Compression.ZipFile]::CreateFromDirectory("$package", "$current_location/newVersion.zip")
    Start-Sleep -Seconds 1
}
Write-Host "Zip file created" -ForegroundColor Green

$ErrorActionPreference = 'Ignore'

try {
    Write-Host "> Removing new version temporary files, please wait..." -NoNewline -ForegroundColor DarkMagenta
    Remove-Item ./newVersion-$version -Recurse -Force
    Start-Sleep -Seconds 1

    Remove-Item ./A.V.A.T.A.R-Client-master.zip -Force
    Start-Sleep -Seconds 1

    Remove-Item ./shell.bat -Force
    Remove-Item ./$app_name -Force
    Write-Host " done" -ForegroundColor Green
    Start-Sleep -Seconds 1
}
catch {
    Write-Host ": " -NoNewline
    Write-Error $_.Exception.InnerException.Message -ErrorAction Continue
    Start-Sleep -Seconds 1
}

# Ready to step 2
Out-File -FilePath ./step-2.txt -InputObject $version-$type_install -Encoding utf8 -NoNewline

Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
Write-Host "█                 Step 1 of the new $version version installation                 █" -ForegroundColor DarkMagenta
Write-Host "█                        has been successfully completed!                      █" -ForegroundColor DarkMagenta
Write-Host "█                  As the client was started with this terminal,               █" -ForegroundColor DarkMagenta
Write-Host "█                   if you close it, you also close the client!                █" -ForegroundColor DarkMagenta
Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
Write-Host "█  You may wish to consult the installation 'update-$version-step1.log' file      █" -ForegroundColor DarkMagenta
Write-Host "█                             in the app/tmp directory                         █" -ForegroundColor DarkMagenta
Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta

# Restart the A.V.A.T.A.R client
$ErrorActionPreference = 'Stop'
Write-Host "> Restarting A.V.A.T.A.R client" -NoNewline -ForegroundColor DarkMagenta
$app_location = "$current_location/../../.."
start-process -filePath "$app_location/A.V.A.T.A.R-Client.exe" -workingdirectory "$app_location"
Write-Host " done" -ForegroundColor Green
Start-Sleep -Seconds 1

Stop-Transcript

