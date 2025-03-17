# testing commands
# ./installer.ps1 -directory "c:\avatar\server" -shortcut
# ./installer.ps1 -directory "c:\avatar\client" -onlycertificate
# ./installer.ps1 -application
# ./installer.ps1 -application -usecertificate "C:/Avatar-dev/installer/client/certificates/hote"
# ./installer.ps1 -directory "C:\Avatar-dev\Windows-client.2.0" -onlycertificate -usecertificate "C:/Avatar-dev/installer/client/certificates/hote"
# ./installer.ps1 -application -onlycertificate -usecertificate "C:/Avatar-dev/installer/client/certificates/hote"
# ./installer.ps1 -directory "/avatar/server" -shortcut

# Parameters
param (
    [string[]]$directory,
    [string[]]$usecertificate,
    [switch]$application,
    [switch]$shortcut,
    [switch]$uninstall,
    [switch]$updateChrome,
    [switch]$onlycertificate,
    [switch]$nocertificate,
    [switch]$nochrome,
    [switch]$nosox,
    [switch]$noffmpeg,
    [switch]$nohostName,
    [switch]$onlyapp,
    [switch]$help
)


function Show-Help {
    Write-Host "Usage: installer.ps1 [options]"
    Write-Host "Installer options:" -ForegroundColor Yellow
    Write-Host "-help            : Display this help."
    Write-Host "-directory       : All platforms. Specify the directory path to be used for installation."
    Write-Host "-application     : macOS and Linux only. Install the client as an application accessible via Finder or the Dock."
    Write-Host "-shortcut        : Windows and Linux only. Create an application icon on the user's desktop."
    Write-Host "-updateChrome    : All platforms. Update the embedded Google Chrome only. Must be used with the -application or -directory parameter to specify the location of the application."
    Write-Host "-usecertificate  : All platforms. Use the HTTPS certificates from the specified directory."
    Write-Host "-onlycertificate : All platforms. Create HTTPS certificates only. Must be used with the -application or -directory parameter to specify the client directory where the certificates will be copied."
    Write-Host "-nocertificate   : All platforms. Do not create and install the HTTPS certificate in the keystore and no configuration of the client is made."
    Write-Host " "
    Write-Host "Description:" -ForegroundColor Yellow
    Write-Host "This script performs an installation by managing specific directories."
    Write-Host "If an existing directory is detected, it will be removed."
    Write-Host " "
    Write-Host "Uninstaller options:" -ForegroundColor Yellow   
    Write-Host "-uninstall       : Specifies if it is an uninstallation." 
    Write-Host "-directory       : All platforms. Specify the path of the directory to be removed."
    Write-Host "-application     : macOS and Linux only. Uninstall the client accessible via Finder or the Dock."
    Write-Host "-onlyapp         : Uninstall the client EXCEPT:"
    Write-Host "                   For Windows:"
    Write-Host "                        Embedded Google Chrome."
    Write-Host "                        The HTTPS certificate in the keystore."    
    Write-Host "                   For linux:"
    Write-Host "                        Embedded Google Chrome."
    Write-Host "                        The HTTPS certificate in the keystore."
    Write-Host "                        Sox"
    Write-Host "                        ffmpeg"
    Write-Host "                   For macOS:"
    Write-Host "                        Embedded Google Chrome."
    Write-Host "                        The HTTPS certificate in the keystore."
    Write-Host "                        Sox"
    Write-Host "                        ffmpeg"
    Write-Host "                        The server's network addressing in the /etc/hosts file."
    Write-Host "-nocertificate   : All platforms. Uninstall the client except the certificate in the keystore."
    Write-Host "-nochrome        : All platforms. Uninstall the client except the embedded Google Chrome."
    Write-Host "-nosox           : macOS and Linux only. Uninstall the client except Sox."
    Write-Host "-noffmpeg        : macOS and Linux only. Uninstall the client except ffmpeg."
    Write-Host "-nohostName      : macOS only. Uninstall the client except the server addressing in the /etc/hosts file."
    Write-Host " "
    Write-Host "More information about the parameters can be found in the installation documentation." -ForegroundColor Yellow
    exit 
}

$platform = if ($(Get-Variable IsWindows -Value)) { "win32" } elseif ($(Get-Variable IsLinux -Value)) { "linux" } elseif ($(Get-Variable IsMacOS -Value)) { "darwin" } else { $null }
$npm = if ($platform -eq "win32") { "npm.cmd" } else { "npm" } 
$npx = if ($platform -eq "win32") { "npx.cmd" } else { "npx" }

function CheckDependencies {
    Write-Host "> Checking dependencies..." -ForegroundColor Yellow
    # Check if npm is installed
    if (-not (Get-Command $npm -ErrorAction SilentlyContinue)) {
        Write-Host "npm is not installed. Please install Node.js and npm to continue." -ForegroundColor Green
        Exit 1
    }

    # Check if PowerShell version is sufficient
    if ($PSVersionTable.PSVersion -lt [Version]"7.0") {
        Write-Host "PowerShell version 7.0 or higher is required." -ForegroundColor Red
        Exit 1
    }
}

if ($platform -eq "win32") {
    # Teste si le script est exécuté en tant qu'administrateur
    If (-Not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Host "This script must be executed in administrator mode." -ForegroundColor Red
        Write-Host "Do a right click on the PowerShell shorcut and select 'Run as Administrator'." -ForegroundColor Red
        Exit 1
    }
}

CheckDependencies

function remove-hostName {

    Write-Host "> Removing hosts file" -ForegroundColor DarkMagenta

    $hostName = if ($platform -eq "win32") {$env:computername.ToLower()} elseif ($platform -eq "linux") {} elseif ($platform -eq "darwin") {$(scutil --get LocalHostName)}
    $foundHostName = $False

    if ($platform -eq "darwin") {
        $hostFile = "/etc/hosts"
        $ip = ifconfig
        Foreach ($line in $ip) {
            if (Select-String -Pattern "inet " -InputObject $line) {
                if (Select-String -Pattern "broadcast " -InputObject $line) {
                    $line = $line.split(" ")
                    $IPAdress = $line[1]
                }   
            }
        }

        if ($null -ne $IPAdress) {
            $fileContent = Get-Content -Path $hostFile -Encoding utf8
            if (Select-String -Pattern "$IPAdress" -InputObject $fileContent) {
                 Foreach ($line in $fileContent) {
                    if (Select-String -Pattern "$IPAdress" -InputObject $line) {
                        $test = $line.split(" ")
                        Foreach ($l in $test) {
                            if ($l.Trim() -eq $hostName) {
                                $foundHostName = $True
                            }
                        }
                    }
                }
            } 
            
            if ($foundHostName) {
                Write-host "> IMPORTANT:" -ForegroundColor Yellow
                Write-host "You must remove now the hostname from the hosts file manually." -ForegroundColor Yellow
                Write-host "Open a NEW terminal and enter the following line:" -ForegroundColor Yellow
                Write-host " "
                Write-host "sudo vi /etc/hosts" -ForegroundColor DarkRed
                Write-host "(then enter your password)" -ForegroundColor DarkRed
                Write-host " "
                Write-host "Find the '$hostName' hostname and go to the line by the arrow down key." -ForegroundColor Yellow
                Write-host " "
                Write-host "If the line contains the IPadress and another text than 'avatar':" -ForegroundColor Yellow
                Write-host "- Go to the first caracter of the hostname by the arrow right key." -ForegroundColor Yellow
                Write-host "- Press the 'x' key until removing the hostname ONLY" -ForegroundColor Yellow
                Write-host "- Leave some white space between the IPadress and the text to be keeped" -ForegroundColor Yellow
                Write-host " "
                Write-host "If the line contains the IPadress and only 'avatar':" -ForegroundColor Yellow
                Write-host "- Press the 'd' key 2 times to remove the line" -ForegroundColor Yellow
                Write-host " "
                Write-host "Save the file and quit by the following line:" -ForegroundColor Yellow
                Write-host " "
                Write-host ":wq!" -ForegroundColor DarkRed
                Write-host " "
                Write-host "If you want, you can check if the file is modified by:" -ForegroundColor Yellow
                Write-host "more /etc/hosts" -ForegroundColor DarkRed
                Write-host " "
                Write-host " "
                Read-Host -Prompt "Press any key when it is done " 
                # Check
                remove-hostName
            } else {
                Write-Host "ipAdress and the hostname are removed from the hosts file" -ForegroundColor Green
            }
        }   
    } 
}


function add-hostName {

    Write-Host "> Updating hosts file" -ForegroundColor DarkMagenta

    $hostName = if ($platform -eq "win32") {$env:computername.ToLower()} elseif ($platform -eq "linux") {} elseif ($platform -eq "darwin") {$(scutil --get LocalHostName)}
    
    if ($platform -eq "darwin") {
        $hostFile = "/etc/hosts"
        $ip = ifconfig
        Foreach ($line in $ip) {
            if (Select-String -Pattern "inet " -InputObject $line) {
                if (Select-String -Pattern "broadcast " -InputObject $line) {
                    $line = $line.split(" ")
                    $IPAdress = $line[1]
                }   
            }
        }

        if ($null -ne $IPAdress) {
            $fileContent = Get-Content -Path $hostFile -Encoding utf8
            if (Select-String -Pattern "$IPAdress" -InputObject $fileContent) {
                 Foreach ($line in $fileContent) {
                    if (Select-String -Pattern "$IPAdress" -InputObject $line) {
                        $foundIpAdress = $True
                        $test = $line.split(" ")
                        Foreach ($l in $test) {
                            if ($l.Trim() -eq $hostName) {
                                $foundHostName = $True
                            }
                        }
                    }
                }
            } 
            
            if ($foundHostName) {
                Write-Host "ipAdress and the hostname are added in the hosts file" -ForegroundColor Green
            } elseif ($foundIpAdress) {
                Write-host "> IMPORTANT:" -ForegroundColor Yellow
                Write-host "You must add now the hostname in the hosts file manually." -ForegroundColor Yellow
                Write-host "Open a NEW terminal and enter the following line:" -ForegroundColor Yellow
                Write-host " "
                Write-host "sudo vi /etc/hosts" -ForegroundColor DarkRed
                Write-host "(then enter your password)" -ForegroundColor DarkRed
                Write-host " "
                Write-host "Find $IPAdress ipAdress and go to the line by the arrow down key." -ForegroundColor Yellow
                Write-host "Press the ALT-A key." -ForegroundColor Yellow
                Write-host "Add the following text (leave at least 2 spaces):" -ForegroundColor Yellow
                Write-host " "
                Write-host "$hostName" -ForegroundColor DarkRed
                Write-host " "
                Write-host "Press the ESC key" -ForegroundColor Yellow
                Write-host "Save the file and quit by the following line:" -ForegroundColor Yellow
                Write-host " "
                Write-host ":wq!" -ForegroundColor DarkRed
                Write-host " "
                Write-host "If you want, you can check if the file is modified by:" -ForegroundColor Yellow
                Write-host "more /etc/hosts" -ForegroundColor DarkRed
                Write-host " "
                Write-host " "
                Read-Host -Prompt "Press any key when it is done " 
                # Check
                add-hostName
            } else {
                Write-host "> IMPORTANT:" -ForegroundColor Yellow
                Write-host "You must add now the ipAdress with the hostname in the hosts file manually." -ForegroundColor Yellow
                Write-host "Open a NEW terminal and enter the following line:" -ForegroundColor Yellow
                Write-host " "
                Write-host "sudo vi /etc/hosts" -ForegroundColor DarkRed
                Write-host "(then enter your password)" -ForegroundColor DarkRed
                Write-host " "
                Write-host "Go to to last line of the file by the arrow down key." -ForegroundColor Yellow
                Write-host "Press the ALT-A keys." -ForegroundColor Yellow
                Write-host "Press the Enter key 2 times." -ForegroundColor Yellow
                Write-host "Add the following line:" -ForegroundColor Yellow
                Write-host " "
                Write-host "$IPAdress  $hostName" -ForegroundColor DarkRed
                Write-host " "
                Write-host "Press the ESC key" -ForegroundColor Yellow
                Write-host "Save the file and quit by the following line:" -ForegroundColor Yellow
                Write-host " "
                Write-host ":wq!" -ForegroundColor DarkRed
                Write-host " "
                Write-host "If you want, you can check if the file is modified by:" -ForegroundColor Yellow
                Write-host "more /etc/hosts" -ForegroundColor DarkRed
                Write-host " "
                Write-host " "
                Read-Host -Prompt "Press any key when it is done " 
                # Check
                add-hostName
            } 
        }   
    } 
}


function Install-Voices {

    Write-Host "> Installing eSpeak and mbrola, please wait..." -ForegroundColor DarkMagenta
    if (-not (Get-Command espeak -ErrorAction SilentlyContinue)) {
        try {
            if (Test-Path /etc/debian_version) {
                sudo apt install espeak 
                Write-Host "> eSpeak installed" -ForegroundColor Green
                $done = $True
            } elseif (Test-Path /etc/redhat-release) {
                    # RedHat-based systems (e.g. CentOS)
                sudo yum install espeak
                Write-Host "> eSpeak installed" -ForegroundColor Green
                $done = $True
            } else {
                Write-Error "Unsupported Linux distribution. Please install eSpeak manually."
            }

            if ($done -eq $True) {
                if (Test-Path /etc/debian_version) {
                    sudo apt install mbrola
                    Write-Host "> mbrola installed" -ForegroundColor Green
                    $done = $True
                } elseif (Test-Path /etc/redhat-release) {
                        # RedHat-based systems (e.g. CentOS)
                    sudo yum install mbrola
                } 

                Write-Host "> eSpeak and mbrola installed" -ForegroundColor Green
                Write-host " "
                Write-host "> IMPORTANT:" -ForegroundColor Yellow
                Write-host "See the documentation to download voices from mbrola github" -ForegroundColor Yellow
                Write-host "(https://github.com/numediart/MBROLA-voices?tab=readme-ov-file)" -ForegroundColor Yellow
                Write-host "and doing the voice configuration." -ForegroundColor Yellow
                Write-host " "
                Read-Host -Prompt "Press any key to continue " 
                Write-host " "
            }
        } catch {
                Write-Error "Failed to install eSpeak and mbrola. Please install eSpeak and mbrola manually."
        }
    } else {
        Write-Host "eSpeak and mbrola are already installed" -ForegroundColor Green
    }

    Start-Sleep -Seconds 1

}


function Install-Sox {
    Write-Host "> Installing Sox, please wait..." -ForegroundColor DarkMagenta

    if ($platform -eq 'win32') {
        if (-Not (Test-Path "./tmp")) {
            New-Item -Path "./tmp" -ItemType "directory"
        } 

        Invoke-WebRequest -UserAgent "Wget" -Uri "https://sourceforge.net/projects/sox/files/sox/14.4.2/sox-14.4.2-win32.zip/download" -OutFile "./tmp/sox.zip"
        Expand-Archive -LiteralPath "./tmp/sox.zip" -DestinationPath "./tmp" -Force

        if (-Not (Test-Path "./lib/sox/win32")) {
            New-Item -Path "./lib/sox/win32" -ItemType "directory"
        } 
        Copy-Item -Path "./tmp/sox-14.4.2/*" -Destination "./lib/sox/win32" -Recurse -Force

        Remove-Item "./tmp/sox.zip" -Force
        Remove-Item "./tmp/sox-14.4.2" -Recurse -Force

        Write-Host "Sox installed" -ForegroundColor Green

    } elseif ($platform -eq 'linux') {

        if (-not (Get-Command sox -ErrorAction SilentlyContinue)) {
            try {
                if (Test-Path /etc/debian_version) {
                    # Debian-based systems (e.g. Ubuntu)
                    sudo apt-get update
                    sudo apt-get install sox
                } elseif (Test-Path /etc/redhat-release) {
                    # RedHat-based systems (e.g. CentOS)
                    sudo yum install sox
                } else {
                    Write-Error "Unsupported Linux distribution. Please install Sox manually."
                }
                Write-Host "Sox installed" -ForegroundColor Green
            } catch {
                Write-Error "Failed to install Sox. Please install Sox manually."
            }
        } else {
            Write-Host "Sox is already installed" -ForegroundColor Green
        }

    } elseif ($platform -eq 'darwin') {
        if (-not (Get-Command sox -ErrorAction SilentlyContinue)) {
            try {
                if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
                    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
                }
                brew install sox
                Write-Host "Sox installed" -ForegroundColor Green
            } catch {
                Write-Error "Failed to install Sox using Homebrew package manager. Please install Sox manually."
            }
        } else {
            Write-Host "Sox is already installed" -ForegroundColor Green
        }
    }

    Start-Sleep -Seconds 1
}


function Install-ffmpeg {

    Write-Host "> Installing FFmpeg, please wait..." -ForegroundColor DarkMagenta

    if ($platform -eq 'win32') {
        if (-Not (Test-Path "./tmp")) {
            New-Item -Path "./tmp" -ItemType "directory"
        } 

        Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile "./tmp/ffmpeg.zip"
        Expand-Archive -LiteralPath "./tmp/ffmpeg.zip" -DestinationPath "./tmp" -Force

        if (-Not (Test-Path "./lib/ffmpeg/win32")) {
            New-Item -Path "./lib/ffmpeg/win32" -ItemType "directory"
        } 
        Copy-Item -Path "./tmp/ffmpeg-7.1.1-essentials_build/*" -Destination "./lib/ffmpeg/win32" -Recurse -Force

        Remove-Item "./tmp/ffmpeg.zip" -Force
        Remove-Item "./tmp/ffmpeg-7.1.1-essentials_build" -Recurse -Force

        Write-Host "FFmpeg installed" -ForegroundColor Green

    } elseif ($platform -eq 'linux') {
        if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
            try {
                if (Test-Path /etc/debian_version) {
                    # Debian-based systems (e.g. Ubuntu)
                    sudo apt-get update
                    sudo apt-get install ffmpeg
                } elseif (Test-Path /etc/redhat-release) {
                    # RedHat-based systems (e.g. CentOS)
                    sudo yum install ffmpeg
                } else {
                    Write-Error "Unsupported Linux distribution. Please install FFmpeg manually."
                }
                Write-Host "FFmpeg installed" -ForegroundColor Green
            } catch {
                Write-Error "Failed to install FFmpeg. Please install FFmpeg manually."
            }
        } else {
            Write-Host "FFmpeg is already installed" -ForegroundColor Green
        }
    } elseif ($platform -eq 'darwin') {
        if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
            try {
                if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
                    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
                }
                brew install ffmpeg
                Write-Host "FFmpeg installed" -ForegroundColor Green
            } catch {
                Write-Error "Failed to install FFmpeg using Homebrew package manager. Please install FFmpeg manually."
            }
        } else {
            Write-Host "FFmpeg is already installed" -ForegroundColor Green
        }
    }

    Start-Sleep -Seconds 1
}


function Install-openssl {

    Write-Host "> Installing OpenSSL, please wait..." -ForegroundColor DarkMagenta

    if ($platform -eq "win32") {
        if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
            $Env:PATH += ";C:\Program Files\OpenSSL-Win64\bin"
        }
        if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
            if (-Not (Test-Path "C:\Program Files\OpenSSL-Win64\bin")) {
                if (!(Get-Command winget -ErrorAction Ignore)) {
                    $URL = "https://api.github.com/repos/microsoft/winget-cli/releases/latest"
                    $URL = (Invoke-WebRequest -Uri $URL -Verbose:$false).Content | ConvertFrom-Json |
                        Select-Object -ExpandProperty "assets" |
                        Where-Object "browser_download_url" -Match '.msixbundle' |
                        Select-Object -ExpandProperty "browser_download_url"
                    $msix = [IO.Path]::Combine([IO.Path]::GetTempPath(), ($URL | Split-Path -Leaf))
                    Write-Verbose "Downloading winget installer to $msix ..."
                    [System.Net.WebClient]::New().DownloadFile([uri]::new($URL), $msix)
                    Write-Host "Installing winget..."
                    Add-AppxPackage -Path $msix
                    Remove-Item $msix
                }
                winget install ShiningLight.OpenSSL.Light
                Write-Host "OpenSSL installed in C:\Program Files\OpenSSL-Win64\bin directory" -ForegroundColor Green
            } else {
                Write-Host "> OpenSSL is already installed" -ForegroundColor Green
            }
            $Env:PATH += ";C:\Program Files\OpenSSL-Win64\bin"
        } else {
            Write-Host "> OpenSSL is already installed" -ForegroundColor Green
        }
        
    } elseif ($platform -eq "linux") {
        if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
            # Install OpenSSL on Linux using the system package manager
            Write-Host "OpenSSL not found. Installing OpenSSL using the system package manager..."
            try {
                if (Test-Path /etc/debian_version) {
                    # Debian-based systems (e.g. Ubuntu)
                    sudo apt-get update
                    sudo apt-get install openssl
                } elseif (Test-Path /etc/redhat-release) {
                    # RedHat-based systems (e.g. CentOS)
                    sudo yum install openssl
                } else {
                    Write-Error "Unsupported Linux distribution. Please install OpenSSL manually."
                    $script:noopenssl = $True
                }
                Write-Host "OpenSSL installed" -ForegroundColor Green
            } catch {
                Write-Error "Failed to install OpenSSL using the system package manager. Please install OpenSSL manually."
                $noopenssl = $True
            }
        } else {
            Write-Host "> OpenSSL is already installed" -ForegroundColor DarkMagenta
        }
    } elseif ($platform -eq "darwin") {
        if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
            # Install OpenSSL on macOS using Homebrew package manager
            Write-Host "OpenSSL not found. Installing OpenSSL using Homebrew package manager..."
            try {
                if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
                    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
                }
                brew install openssl
                Write-Host "OpenSSL installed" -ForegroundColor Green
            } catch {
                Write-Error "Failed to install OpenSSL using Homebrew package manager. Please install OpenSSL manually."
                $noopenssl = $True
            }
        } else {
            Write-Host "OpenSSL is already installed" -ForegroundColor Green
        }
    } 

    Start-Sleep -Seconds 1
}


function Install-CA {

    if ($noopenssl -eq $False) {

        Write-Host "> Creating HTTPS Certificate Authority (CA)..." -ForegroundColor DarkMagenta

        if (-Not (Test-Path "$current_location/certificates/CA")) {
            New-Item -Path "$current_location/certificates/CA" -ItemType "directory"
        } else {
            Remove-Item "$current_location/certificates/CA/*" -Force
        }
        Set-Location -Path "$current_location/certificates/CA"

        Write-Host "> Creating private key (.key)"
        Write-Warning " A passphrase is required to encrypt the private key."
        Write-Warning " This will be used to sign the host certificate. You can enter what you want but remember it!"
        start-process -FilePath "openssl" -ArgumentList "genrsa -des3 -out ./avatarCA.key 2048" -NoNewWindow -workingdirectory "." -Wait
        Write-Host "> Private key created" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "> Creating PEM certificate (.pem)"
        Write-Warning " Enter the passphrase entered [just before] to encrypt the private key."
        
        $Country_Name = "FR"
        $State_Name = '"Ile de france"'
        $Locality_Name = "Paris"
        $Org_Name = '"A.V.A.T.A.R client CA"'

        $subject = "/C=${Country_Name}/ST=${State_Name}/L=${Locality_Name}/O=${Org_Name}/CN=${Org_Name}"
        start-process -FilePath "openssl" -ArgumentList "req -x509 -new -nodes -key ./avatarCA.key -sha256 -days 10000 -out ./avatarCA.pem -subj ${subject}" -NoNewWindow -workingdirectory "." -Wait
        Write-Host "> Root certificate created (.pem)" -ForegroundColor Green
        Write-Host ""

        Write-Host "> Creating CRT certificate (.crt)"
        start-process -FilePath "openssl" -ArgumentList "x509 -in ./avatarCA.pem -inform PEM -out ./avatarCA.crt" -NoNewWindow -workingdirectory "." -Wait
        Write-Host "> Root certificate created (.crt)" -ForegroundColor Green
        Write-Host ""

        Write-Host "> Importing Certificate Authority to the keystore"
        if ($platform -eq "win32") {
            try {
                $CN = "*A.V.A.T.A.R client CA*"
                Get-ChildItem Cert:\LocalMachine\Root | ForEach-Object { if ($_.Subject -like $CN) { Remove-Item $_.PSPath -Force }}

                $file = (Get-ChildItem -Path "./avatarCA.crt")
                $file | Import-Certificate -CertStoreLocation Cert:\LocalMachine\Root
                Write-Host "> Certificate imported" -ForegroundColor Green
            } catch {
                Write-Error "Unable to import Certificate Authority to the keystore. please, try to import the certificate manually"
                $noopenssl = $True
            }
        } elseif ($platform -eq "linux") {

            if (Test-Path /etc/debian_version) {

                if (-Not (Test-Path "/usr/local/share/ca-certificates")) {
                    sudo mkdir /usr/local/share/ca-certificates
                } 

                if (Test-Path "/usr/local/share/ca-certificates/avatarCA.crt") {
                    sudo rm /usr/local/share/ca-certificates/avatarCA.crt
                    sudo update-ca-certificates -f

                    $installed = certutil -d sql:$HOME/.pki/nssdb -L
                    Foreach ($certif in $installed) {
                        if (Select-String -Pattern "avatar" -InputObject $certif) {
                            sudo certutil -d sql:$HOME/.pki/nssdb/ -D -n "avatar"
                            Write-Host "> Old Certificate Authority removed from the $env:HOME/.pki/nssdb database" -ForegroundColor Green
                        }
                    }
                }

                sudo cp ./avatarCA.crt /usr/local/share/ca-certificates
                sudo update-ca-certificates

                $dbfiles = find ~ -name "cert9.db"
                Foreach ($dbfile in $dbfiles) {
                    if (Select-String -Pattern ".pki/nssdb/cert9.db" -InputObject $dbfile) {
                        $dbfound = $True
                    }
                }

                if ($dbfound) {
                    certutil -A -n "avatar" -t "C," -i ./avatarCA.pem -d sql:$HOME/.pki/nssdb/
                    Write-Host "> Certificate Authority imported to the $env:HOME/.pki/nssdb database" -ForegroundColor Green
                } else {
                    Write-Error "Unable to import the Certificate Authority to the database. please, try to import the certificate manually."
                    $noopenssl = $True
                }
            } else {
                Write-Error "Unsupported Linux distribution. try to import the Certificate Authority manually."
            }
        } elseif ($platform -eq "darwin") {
            try {
                $CN = "A.V.A.T.A.R client CA"
                $test = sudo security find-certificate -c "$CN"
                if ($null -ne $test) {
                    Write-Host "> Removing Old Certificate Authority" -ForegroundColor DarkMagenta     
                    sudo security delete-certificate -c "$CN" /Library/Keychains/System.keychain
                    Write-Host "> Old Certificate Authority removed" -ForegroundColor Green
                }

                Write-Host " "
                Write-Host "> Enter the user passsword" -ForegroundColor Green
                sudo security add-trusted-cert -d -k /Library/Keychains/System.keychain "./avatarCA.crt"
                Write-Host "> Certificate Authority imported to the keystore" -ForegroundColor Green
            } catch {
                Write-Error "Unable to import the Certificate Authority to the keystore. please, try to import the certificate manually."
                $noopenssl = $True
            }
        }

        Start-Sleep -Seconds 1
    }
}


function Install-puppeteer {

    $Chromefolder = if ($platform -eq "win32") {
        "$env:USERPROFILE/.cache/puppeteer"
    } elseif ($platform -eq "linux") {
        "~/.cache/puppeteer"
    } elseif ($platform -eq "darwin") {
        "$HOME/.cache/puppeteer"
    }

    if ((Test-Path "$Chromefolder") -eq $True) {
        Remove-Item "$Chromefolder" -Recurse -Force
        if ((Test-Path "$Chromefolder") -eq $True) {Remove-Item "$Chromefolder" -Recurse -Force}
        if ((Test-Path "$Chromefolder") -eq $True) {
            Write-host " "
            Write-Host "WARNING:" -ForegroundColor Yellow
            Write-Host "Unable to completely remove the old embedded Google Chrome for the A.V.A.T.A.R client." -ForegroundColor Yellow
            Write-Host "Please, open a Explorer and remove the $Chromefolder directory manually." -ForegroundColor Yellow
            Write-host " "
        } 
    }

    $folder = if ($platform -eq "win32" -or ($platform -eq "linux" -and $application -eq $False)) {
        "$directory/resources/app"
    } elseif ($platform -eq "linux" -and $application -eq $True) {
        "/usr/lib/a.v.a.t.a.r-client/resources/app"
    } elseif ($platform -eq "darwin" -and $application -eq $False) {
        "$directory/Contents/Resources/app"
    } elseif ($platform -eq "darwin" -and $application -eq $True) {
        "/Applications/A.V.A.T.A.R-Client.app/Contents/Resources/app"
    }

    Set-Location -Path "$folder"   

    Write-Host "> Updating puppeteer, please wait..." -ForegroundColor DarkMagenta
    start-process -FilePath $npm -ArgumentList "uninstall", "puppeteer" -NoNewWindow -workingdirectory "." -Wait 
    start-process -FilePath $npm -ArgumentList "install", "puppeteer" -NoNewWindow -workingdirectory "." -Wait 
    Write-Host "puppeteer updated" -ForegroundColor Green
    Start-Sleep -Seconds 1
}


function Install-Hote {

    if ($noopenssl -eq $False) {
        $computerName = if ($platform -eq "win32") {$env:computername.ToLower()} elseif ($platform -eq "linux") {hostname} elseif ($platform -eq "darwin") {$(scutil --get LocalHostName)}

        if ($null -eq $usecertificate) {
            Write-Host "> Creating HTTPS host client certificates..." -ForegroundColor DarkMagenta

            if (-Not (Test-Path "$current_location/certificates/hote")) {
                New-Item -Path "$current_location/certificates/hote" -ItemType "directory"
            } else {
                Remove-Item "$current_location/certificates/hote/*" -Force
            }

            Set-Location -Path "$current_location/certificates/hote"
            
            Write-Host "> Creating private key (.key)"
            start-process -FilePath "openssl" -ArgumentList "genrsa -out ./$computerName.key 2048" -NoNewWindow -workingdirectory "." -Wait
            Write-Host "> Private key created" -ForegroundColor Green
            Write-Host ""

            Write-Host "> Creating PEM certificate (.pem)"
            $Country_Name = "FR"
            $State_Name = '"Ile de france"'
            $Locality_Name = "Paris"
            $Org_Name = '"A.V.A.T.A.R client"'

            $subject = "/C=${Country_Name}/ST=${State_Name}/L=${Locality_Name}/O=${Org_Name}/OU=${Org_Name}/CN=${computerName}"
            start-process -FilePath "openssl" -ArgumentList "req -new -key ./$computerName.key -out ./$computerName.csr -subj $subject" -NoNewWindow -workingdirectory "." -Wait
            Write-Host "> Root certificate created (.pem)" -ForegroundColor Green
            Write-Host ""

            "authorityKeyIdentifier=keyid,issuer" | Out-File -FilePath "./$computerName.ext"
            "basicConstraints=CA:FALSE" | Out-File -FilePath "./$computerName.ext" -Append
            "keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment" | Out-File -FilePath "./$computerName.ext" -Append
            "subjectAltName = @alt_names" | Out-File -FilePath "./$computerName.ext" -Append
            "[alt_names]" | Out-File -FilePath "./$computerName.ext" -Append
            "DNS.1 = $computerName" | Out-File -FilePath "./$computerName.ext" -Append

            Write-Host "> Creating CRT certificate (.crt)"
            Write-Warning " Enter the passphrase entered [just before] to encrypt the private key of the HTTPS certicate authority."
            start-process -FilePath "openssl" -ArgumentList "x509 -req -in ./$computerName.csr -CA ../CA/avatarCA.pem -CAkey ../CA/avatarCA.key -CAcreateserial -out ./$computerName.crt -days 10000 -sha256 -extfile ./$computerName.ext" -NoNewWindow -workingdirectory "." -Wait
            Write-Host "> Root certificate created (.crt)" -ForegroundColor Green
            Write-Host ""
        }

        $folder = if ($platform -eq "win32" -or ($platform -eq "linux" -and $application -eq $False)) {
            "$directory/resources/app/core"
        } elseif ($platform -eq "linux" -and $application -eq $True) {
            "/usr/lib/a.v.a.t.a.r-client/resources/app/core"
        } elseif ($platform -eq "darwin" -and $application -eq $False) {
            "$directory/Contents/Resources/app/core"
        } elseif ($platform -eq "darwin" -and $application -eq $True) {
            "/Applications/A.V.A.T.A.R-Client.app/Contents/Resources/app/core"
        }

        if (Test-Path "$folder") {
            if (-Not (Test-Path "$folder/chrome/certificates")) {
                New-Item -Path "$folder/chrome/certificates" -ItemType "directory"
            } else {
                Remove-Item "$folder/chrome/certificates/*" -Force
            }

            $certifFolder = if ("$usecertificate") {"$usecertificate/*"} else {"./*"}

            Write-Host "> Copying host certificates to the client certificates directory" -NoNewline -ForegroundColor DarkMagenta
            $omissions = [string[]]@("$computerName.ext","$computerName.csr")
            Copy-Item -Path $certifFolder -Exclude $omissions -Destination "$folder/chrome/certificates" -Recurse -Force
            Write-Host " done" -ForegroundColor Green

            Write-Host "> Updating Chrome properties file" -NoNewline -ForegroundColor DarkMagenta
            $file = Get-Content "$folder/plugins/chrome/chrome.json" -Encoding utf8 | ConvertFrom-Json
            $file.modules.chrome.key="$computerName.key"
            $file.modules.chrome.cert="$computerName.crt"
            $file.modules.chrome.address="$computerName"
            $file | ConvertTo-Json -EscapeHandling EscapeHtml -depth 32 | ForEach-Object { [System.Text.RegularExpressions.Regex]::Unescape($_) } | Out-File "$folder/plugins/chrome/chrome.json"
            Write-Host " done" -ForegroundColor Green
        } else {
            Write-Host "> Certificates created in the ./certificates directory" -ForegroundColor Green
        }

        Start-Sleep -Seconds 1
    }
}


function Uninstall-ElectronPackager {
    # Uninstalling Electron packager
    Write-Host "> Uninstalling Electron packager, please wait..." -ForegroundColor DarkMagenta
    start-process -FilePath $npm -ArgumentList "uninstall", "@electron/packager" -NoNewWindow -workingdirectory "." -Wait 
    Write-Host "Electron packager uninstalled" -ForegroundColor Green
    Start-Sleep -Seconds 1
}

function Install-Electron {
    param ($workingdirectory)

    Write-Host "> Installing nmp packages, please wait..." -ForegroundColor DarkMagenta
    start-process -FilePath $npm -ArgumentList "install" -NoNewWindow -workingdirectory $workingdirectory -Wait
    Write-Host "npm packages installation done" -ForegroundColor Green
    Start-Sleep -Seconds 1
}

function Set-NewApplication {
    param (
        $folder, 
        $destination
    )
    # Copy new version as Applications
    Write-Host "> Installing A.V.A.T.A.R client application, please wait..." -NoNewline -ForegroundColor DarkMagenta
    $omissions = [string[]]@("LICENSE","version","LICENSES.chromium.html")
    Copy-Item -Path "$folder" -Exclude $omissions -Destination "$destination" -Recurse -Force
    Write-Host " done" -ForegroundColor Green
    Start-Sleep -Seconds 1
}


function Uninstall-app {

    Write-Host ""
    $confirm = Read-Host -Prompt "Would you really like to uninstall A.V.A.T.A.R client (Y/N)[N]?"
    if ([string]::IsNullOrWhiteSpace($confirm)) {
        $confirm ="N"
    }
    if ($confirm.ToLower() -eq 'n') {
        Write-Host ""
        Write-Host "Bye bye, have a good day!" -ForegroundColor DarkMagenta 
        Write-Host ""
        Stop-Transcript
        exit
    }
    Write-Host ""
    $current_location = Get-Location
    
    $folder = if ($platform -eq "win32" -or ($platform -eq "linux" -and $application -eq $False) -or ($platform -eq "darwin" -and $application -eq $False)) {
        "$directory"
    } elseif ($platform -eq "linux" -and $application -eq $True) {
        "/usr/lib/a.v.a.t.a.r-client"
    } elseif ($platform -eq "darwin" -and $application -eq $True) {
        "/Applications/A.V.A.T.A.R-Client.app"
    }

    $Chromefolder = if ($platform -eq "win32") {
        "$env:USERPROFILE/.cache/puppeteer"
    } elseif ($platform -eq "linux") {
        "~/.cache/puppeteer"
    } elseif ($platform -eq "darwin") {
        "$HOME/.cache/puppeteer"
    } 

    if ($platform -eq "win32" ) {
        
        if ((Test-Path "$folder") -eq $True) {

            $checkVersionFile = if ($platform -eq "win32") {
                "$directory/resources/app/assets/config/default/Avatar.prop"
            } 

            $json_avatar = Get-Content $checkVersionFile -Encoding utf8 | ConvertFrom-Json
            $version = $json_avatar.Version
            $DesktopPath = [Environment]::GetFolderPath('Desktop')
            $ShortcutPath = Join-Path -Path $DesktopPath -ChildPath "A.V.A.T.A.R Client $version.lnk"

            if ($version -and ((Test-Path "$ShortcutPath") -eq $True)) {
                Write-Host "> Removing A.V.A.T.A.R client desktop shortcut" -ForegroundColor DarkMagenta
                Remove-Item "$ShortcutPath" -Force
                Write-Host "A.V.A.T.A.R client desktop shortcut removed" -ForegroundColor Green
            }

            Remove-Item "$folder" -Recurse -Force
            if ((Test-Path "$folder") -eq $True) {Remove-Item "$folder" -Recurse -Force}
            if ((Test-Path "$folder") -eq $True) {
                Write-host " "
                Write-Host "WARNING:" -ForegroundColor Yellow
                Write-Host "Unable to completely remove the A.V.A.T.A.R client directory." -ForegroundColor Yellow
                Write-Host "Please, open a Windows Explorer and remove the $folder directory manually." -ForegroundColor Yellow
                Write-host " "
            } else {
                Write-Host "A.V.A.T.A.R client removed" -ForegroundColor Green
            }
        } else {
            Write-Host "A.V.A.T.A.R client directory not exists. Ignored." -ForegroundColor Yellow
        }

        if ($onlyapp -eq $False) {

            if ($nochrome -eq $False) {
                Write-Host "> Removing embedded Google Chrome for A.V.A.T.A.R client, please wait..." -ForegroundColor DarkMagenta
                if ((Test-Path "$Chromefolder") -eq $True) {
                    Remove-Item "$Chromefolder" -Recurse -Force
                    if ((Test-Path "$Chromefolder") -eq $True) {Remove-Item "$Chromefolder" -Recurse -Force}
                    if ((Test-Path "$Chromefolder") -eq $True) {
                        Write-host " "
                        Write-Host "WARNING:" -ForegroundColor Yellow
                        Write-Host "Unable to completely remove the embedded Google Chrome for A.V.A.T.A.R client." -ForegroundColor Yellow
                        Write-Host "Please, open a Explorer and remove the $Chromefolder directory manually." -ForegroundColor Yellow
                        Write-host " "
                    } else {
                        Write-Host "Embedded Google Chrome for A.V.A.T.A.R client removed" -ForegroundColor Green
                    }
                } else {
                    Write-Host "Embedded Google Chrome for A.V.A.T.A.R client not exists. Ignored." -ForegroundColor Yellow
                }
            }

            if ($nocertificate -eq $False) {
                Write-Host "> Removing Certificate Authority" -ForegroundColor DarkMagenta
                $CN = "*A.V.A.T.A.R client CA*"
                Get-ChildItem Cert:\LocalMachine\Root | ForEach-Object { if ($_.Subject -like $CN) { 
                    Remove-Item $_.PSPath -Force 
                    $script:win32found = $False
                }}  
                Get-ChildItem Cert:\LocalMachine\Root | ForEach-Object { if ($_.Subject -like $CN) { $script:win32found = $True }} 
                if ($win32found -eq $True) {
                    Write-Host "WARNING:" -ForegroundColor Yellow
                    Write-Host "Unable to remove the Certificate Authority" -ForegroundColor Yellow
                    Write-host "You must remove the Certificate Authority manually." -ForegroundColor Yellow
                    Write-host "Select Trusted Root Certification Authorities -> Certificates" -ForegroundColor Yellow
                    Write-Host "Click on 'A.V.A.T.A.R client CA' certificate" -ForegroundColor Yellow
                    Write-Host "Do a right-click and select Delete" -ForegroundColor Yellow
                    Write-Host "Answer 'Yes' to confirm" -ForegroundColor Yellow
                    certmgr.msc
                } elseif ($win32found -eq $False) {
                    Write-Host "Certificate Authority removed" -ForegroundColor Green
                } elseif ($null -eq $win32found) {
                    Write-Host "Certificate Authority not exists. Ignored." -ForegroundColor Yellow
                }
            }
        }

    } elseif ($platform -eq "linux") {

        if ($application -eq $False) {
            $desktopFile = "$env:HOME/.local/share/applications/a.v.a.t.a.r-client.desktop"
            if ((Test-Path "$desktopFile") -eq $True) {
                Write-Host "> Removing A.V.A.T.A.R client desktop shortcut" -ForegroundColor DarkMagenta
                Remove-Item "$desktopFile" -Force
                Write-Host "A.V.A.T.A.R client desktop shortcut removed" -ForegroundColor Green
            }
        }

        Write-Host "> Removing A.V.A.T.A.R client, please wait..." -ForegroundColor DarkMagenta
        if ((Test-Path "$folder") -eq $True) {
            if ($application -eq $True) { 
                start-process -FilePath "sudo" -ArgumentList "apt remove a.v.a.t.a.r-client" -NoNewWindow -workingdirectory "." -Wait
            }
            if ((Test-Path "$folder") -eq $True) {
                start-process -FilePath "sudo" -ArgumentList "rm -r $folder" -NoNewWindow -workingdirectory "." -Wait
            }
            Write-Host "A.V.A.T.A.R client removed" -ForegroundColor Green
        } else {
            Write-Host "A.V.A.T.A.R client directory not exists. Ignored." -ForegroundColor Yellow
        }

        if ($onlyapp -eq $False) {
            if ($nochrome -eq $False) {
                Write-Host "> Removing embedded Chrome for A.V.A.T.A.R client, please wait..." -ForegroundColor DarkMagenta
                if ((Test-Path "$Chromefolder") -eq $True) {
                    Remove-Item "$Chromefolder" -Recurse -Force
                    if ((Test-Path "$Chromefolder") -eq $True) {
                    start-process -FilePath "sudo" -ArgumentList "rm -r $Chromefolder" -NoNewWindow -workingdirectory "." -Wait
                    }
                    if ((Test-Path "$Chromefolder") -eq $True) {
                        Write-host " "
                        Write-Host "WARNING:" -ForegroundColor Yellow
                        Write-Host "Unable to completely remove the embedded Chrome for A.V.A.T.A.R client directory." -ForegroundColor Yellow
                        Write-Host "Please, open a Explorer and remove the $Chromefolder directory manually." -ForegroundColor Yellow
                        Write-host " "
                    } else {
                        Write-Host "Embedded Chrome for A.V.A.T.A.R client removed" -ForegroundColor Green
                    }
                } else {
                    Write-Host "Embedded Chrome for A.V.A.T.A.R client not exists. Ignored." -ForegroundColor Yellow
                }
            }

            if ($nocertificate -eq $False) {
                Write-Host "> Removing Certificate Authority" -ForegroundColor DarkMagenta
                $installed = certutil -d sql:$HOME/.pki/nssdb -L
                Foreach ($certif in $installed) {
                    if (Select-String -Pattern "avatar" -InputObject $certif) {
                        sudo certutil -d sql:$HOME/.pki/nssdb/ -D -n "avatar"

                        $linuxfound = $False
                        $installed = certutil -d sql:$HOME/.pki/nssdb -L
                        Foreach ($certif in $installed) {
                            if (Select-String -Pattern "avatar" -InputObject $certif) {
                                $linuxfound = $True
                            }
                        }
                    }
                }

                if ($linuxfound -eq $False) {
                    Write-Host "Certificate Authority removed" -ForegroundColor Green
                } elseif ($linuxfound -eq $True) {
                    Write-Host "WARNING:" -ForegroundColor Yellow
                    Write-Host "Unable to remove the Certificate Authority" -ForegroundColor Yellow
                    Write-host "You must remove the Certificate Authority manually." -ForegroundColor Yellow
                    Write-host "Open a terminal and enter the following command:" -ForegroundColor Yellow
                    Write-Host "sudo certutil -d sql:$HOME/.pki/nssdb/ -D -n 'avatar'" -ForegroundColor Yellow
                } elseif ($null -eq $linuxfound) {
                    Write-Host "Certificate Authority not exists. Ignored." -ForegroundColor Yellow
                }
            }

            if ($nosox -eq $False) {
                if (Get-Command sox -ErrorAction SilentlyContinue) {
                    Write-Host "> Uninstalling Sox" -ForegroundColor DarkMagenta 
                    if (Test-Path /etc/debian_version) {
                        # Debian-based systems (e.g. Ubuntu)
                        sudo apt-get update
                        sudo apt-get remove sox
                    } elseif (Test-Path /etc/redhat-release) {
                        # RedHat-based systems (e.g. CentOS)
                        sudo yum uninstall sox
                    } else {
                        Write-Error "Unsupported Linux distribution. Please uninstall Sox manually."
                    }
                    Write-Host "Sox Uninstalled" -ForegroundColor Green
                } else {
                    Write-Host "Sox application not exists. Ignored." -ForegroundColor Yellow
                }
            }

            if ($noffmpeg -eq $False) {
                if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
                    Write-Host "> Uninstalling FFmpeg" -ForegroundColor DarkMagenta 
                    if (Test-Path /etc/debian_version) {
                        # Debian-based systems (e.g. Ubuntu)
                        sudo apt-get update
                        sudo apt-get remove ffmpeg
                    } elseif (Test-Path /etc/redhat-release) {
                        # RedHat-based systems (e.g. CentOS)
                        sudo yum uninstall ffmpeg
                    } else {
                        Write-Error "Unsupported Linux distribution. Please uninstall FFmpeg manually."
                    }
                    Write-Host "FFmpeg Uninstalled" -ForegroundColor Green
                } else {
                    Write-Host "FFmpeg application not exists. Ignored." -ForegroundColor Yellow
                }
            }
        }

    } elseif ($platform -eq "darwin") {

        Write-Host "> Removing A.V.A.T.A.R client, please wait..." -ForegroundColor DarkMagenta
        if ((Test-Path "$folder") -eq $True) {
            Remove-Item "$folder" -Recurse -Force
            if ((Test-Path "$folder") -eq $True) {
               start-process -FilePath "sudo" -ArgumentList "rm -r $folder" -NoNewWindow -workingdirectory "." -Wait
            }
            if ((Test-Path "$folder") -eq $True) {
                Write-host " "
                Write-Host "WARNING:" -ForegroundColor Yellow
                Write-Host "Unable to completely remove the A.V.A.T.A.R-Client.app directory." -ForegroundColor Yellow
                Write-Host "Please, open a Finder and remove the A.V.A.T.A.R-Client manually." -ForegroundColor Yellow
                Write-host " "
            } else {
                Write-Host "A.V.A.T.A.R client removed" -ForegroundColor Green
            }
        } else {
            Write-Host "A.V.A.T.A.R client directory not exists. Ignored." -ForegroundColor Yellow
        }

        if ($onlyapp -eq $False) {
            if ($nochrome -eq $False) {
                Write-Host "> Removing embedded Chrome for A.V.A.T.A.R client, please wait..." -ForegroundColor DarkMagenta
                if ((Test-Path "$Chromefolder") -eq $True) {
                    Remove-Item "$Chromefolder" -Recurse -Force
                    if ((Test-Path "$Chromefolder") -eq $True) {
                        start-process -FilePath "sudo" -ArgumentList "rm -r $Chromefolder" -NoNewWindow -workingdirectory "." -Wait
                    }
                    if ((Test-Path "$Chromefolder") -eq $True) {
                        Write-host " "
                        Write-Host "WARNING:" -ForegroundColor Yellow
                        Write-Host "Unable to completely remove the embedded Chrome for A.V.A.T.A.R client directory." -ForegroundColor Yellow
                        Write-Host "Please, open a Explorer and remove the $Chromefolder directory manually." -ForegroundColor Yellow
                        Write-host " "
                    } else {
                        Write-Host "Embedded Chrome for A.V.A.T.A.R client removed" -ForegroundColor Green
                    }
                } else {
                    Write-Host "Embedded Chrome for A.V.A.T.A.R client not exists. Ignored." -ForegroundColor Yellow
                }
            }

            if ($nocertificate -eq $False) {
                $CN = "A.V.A.T.A.R client CA"
                Write-Host "> Removing Certificate Authority" -ForegroundColor DarkMagenta 
                $test = sudo security find-certificate -c "$CN"
                if ($null -ne $test) {    
                    sudo security delete-certificate -c "$CN" /Library/Keychains/System.keychain
                    $test = sudo security find-certificate -c "$CN"
                    if ($null -ne $test) {
                        Write-Host "WARNING:" -ForegroundColor Yellow
                        Write-Host "Unable to remove the Certificate Authority" -ForegroundColor Yellow
                        Write-host "You must remove the Certificate Authority manually." -ForegroundColor Yellow
                        Write-host "Open the Keystore Access application and select 'System'" -ForegroundColor Yellow
                        Write-Host "Click on 'A.V.A.T.A.R client CA' certificate" -ForegroundColor Yellow
                        Write-Host "Do a right-click and select Delete" -ForegroundColor Yellow
                    } else  {   
                        Write-Host "Certificate Authority removed" -ForegroundColor Green
                    }  
                } else {
                        Write-Host "Certificate Authority not exists. Ignored." -ForegroundColor Yellow
                }
            } 

            if ($nosox -eq $False) {
                if (Get-Command sox -ErrorAction SilentlyContinue) {
                    Write-Host "> Uninstalling Sox" -ForegroundColor DarkMagenta 
                    if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
                        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
                    }
                    brew uninstall sox
                    Write-Host "Sox uninstalled" -ForegroundColor Green
                } else {
                    Write-Host "Sox application not exists. Ignored." -ForegroundColor Yellow
                }
            }

            if ($noffmpeg -eq $False) {
                if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
                    Write-Host "> Uninstalling FFmpeg" -ForegroundColor DarkMagenta 
                    if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
                        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
                    }
                    brew uninstall ffmpeg
                    Write-Host "FFmpeg uninstalled" -ForegroundColor Green
                }
            } else {
                Write-Host "FFmpeg application not exists. Ignored." -ForegroundColor Yellow
            }

            if ($nohostName -eq $False) {
                remove-hostName
            }
        }
    }
    
    Set-Location -Path $current_location
    # Reset directory location
    Write-Host ""
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "█            A.V.A.T.A.R client has been successfully uninstalled!             █" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Stop-Transcript
    exit

}


function Update-Chrome {

    Write-Host "> Updating embedded Google Chrome: " -NoNewline 
    Write-Host "Yes" -ForegroundColor Magenta
    Write-Host ""
    $confirm = Read-Host -Prompt "Would you like to update the embedded Google Chrome only (Y/N)[Y]?"
    if ([string]::IsNullOrWhiteSpace($confirm)) {
        $confirm ="Y"
    }
    if ($confirm.ToLower() -eq 'n') {
        Write-Host ""
        Write-Host "Bye bye, have a good day!" -ForegroundColor DarkMagenta 
        Write-Host ""
        Stop-Transcript
        exit
    }
    $current_location = Get-Location
    Install-puppeteer

    Set-Location -Path $current_location
    # Reset directory location
    Write-Host ""
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "█           Embedded Google Chrome have been successfully updated!             █" -ForegroundColor DarkMagenta
    Write-Host "█                                  Have fun !                                  █" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Stop-Transcript
    exit

}


function Install-CertificatesOnly {

    Write-Host "> Certificate creation: " -NoNewline 
    Write-Host "Yes" -ForegroundColor Magenta
    Write-Host ""
    $confirm = Read-Host -Prompt "Would you like to create HTTPS certificates only (Y/N)[Y]?"
    if ([string]::IsNullOrWhiteSpace($confirm)) {
        $confirm ="Y"
    }
    if ($confirm.ToLower() -eq 'n') {
        Write-Host ""
        Write-Host "Bye bye, have a good day!" -ForegroundColor DarkMagenta 
        Write-Host ""
        Stop-Transcript
        exit
    }
    $current_location = Get-Location
    if ($null -eq $usecertificate) {
        Install-openssl
        Install-CA
    }
    Install-Hote
    Install-puppeteer
    
    Set-Location -Path $current_location
    # Reset directory location
    Write-Host ""
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "█       A.V.A.T.A.R client certificates have been successfully installed!      █" -ForegroundColor DarkMagenta
    Write-Host "█                                  Have fun !                                  █" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Stop-Transcript
    exit
}

Clear-Host

if ($help) {
    Show-Help
}

$ErrorActionPreference = "Ignore"

if (Test-Path ./client-installer.log -PathType Leaf) {
    Remove-Item ./client-installer.log -Force
}
$ErrorActionPreference = "Stop"

Start-Transcript -path ./client-installer.log -append

if ($uninstall -eq $False) {
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Write-Host "█                     =========================================                █" -ForegroundColor DarkMagenta
    Write-Host "█                           A.V.A.T.A.R client installer                       █" -ForegroundColor DarkMagenta
    Write-Host "█                     ========== Windows/linux/darwin =========                █" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "█   Created by:     avatar.home.automation@gmail.com                           █" -ForegroundColor DarkMagenta
    Write-Host "█   Creation date:  11-17-2024                                                 █" -ForegroundColor DarkMagenta
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
} else {
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
    Write-Host "█                   =========================================                  █" -ForegroundColor DarkMagenta
    Write-Host "█                         A.V.A.T.A.R client uninstaller                       █" -ForegroundColor DarkMagenta
    Write-Host "█                   ========== Windows/linux/darwin =========                  █" -ForegroundColor DarkMagenta
    Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
    Write-Host "█   Created by:     avatar.home.automation@gmail.com                           █" -ForegroundColor DarkMagenta
    Write-Host "█   Creation date:  11-17-2024                                                 █" -ForegroundColor DarkMagenta
    Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
}

# Test platform parameter
if ($null -eq $platform) {
    Write-Host ""
    Write-Host "ERROR: The platform is not compatible, must be win32/linux/darwin (see the documentation)." -ForegroundColor DarkRed
    Write-Host ""
    Stop-Transcript
    exit    
}

# Test installation type
if ($null -eq $directory -and $application -eq $False) {
    Write-Host ""
    Write-Host "ERROR: At least -directory or -application parameter is required (see the documentation)" -ForegroundColor DarkRed
    Write-Host ""
    Stop-Transcript
    exit
}

# Test installation path (only for win32)
if ($null -eq $directory -and $platform -eq "win32") {
    Write-Host ""
    Write-Host "ERROR: For a Windows installation, the -directory parameter is required (see the documentation)." -ForegroundColor DarkRed
    Write-Host ""
    Stop-Transcript
    exit
}

# Test installation type
if ($null -ne $directory -and $application -eq $True) {
    Write-Host ""
    Write-Host "ERROR: Choose between -directory or -application but not both at the same time (see the documentation)." -ForegroundColor DarkRed
    Write-Host ""
    Stop-Transcript
    exit
}

if ($null -ne $usecertificate -and -Not (Test-Path "$usecertificate")) {
    Write-Host ""
    Write-Host "ERROR: the directory in the -usecertificate parameter does not exist." -ForegroundColor DarkRed
    Write-Host ""
    Stop-Transcript
    exit
}

# Summary
Write-Host ""
Write-Host "> Installation platform: " -NoNewline 
Write-Host "$platform" -ForegroundColor Magenta
Write-Host "> Installation directory: " -NoNewline 
if ($application -eq $True) {
    if ($platform -eq "linux") {
        Write-Host "Application by the debian installer"
    } elseif ($platform -eq "darwin") {
        Write-Host "Application (Finder) by the installer" 
    } else {
        Write-Host "$directory" -ForegroundColor Magenta
    }
} else {
    if ($platform -eq "linux" -or $platform -eq "darwin") {
        $directory = "$env:HOME/$directory"
        Write-Host "$directory" -ForegroundColor Magenta
    } else {
        Write-Host "$directory" -ForegroundColor Magenta
    } 
}

if ($uninstall -eq $True) {
    if ($null -eq $directory -and $application -eq $False) {
        Write-Host ""
        Write-Host "ERROR: uninstalling the application required a -directory or -application parameter (see the documentation)." -ForegroundColor DarkRed
        Write-Host ""
        Stop-Transcript
        exit
    }

    Uninstall-app 
}

if ($updateChrome -eq $True) {
    if ($null -eq $directory -and $application -eq $False) {
        Write-Host ""
        Write-Host "ERROR: For the update of embedded Google Chrome, the -directory or -application parameter is required (see the documentation)." -ForegroundColor DarkRed
        Write-Host ""
        Stop-Transcript
        exit
    }

    Update-Chrome
}

if ($onlycertificate -eq $True) {
    if ($null -eq $directory -and $application -eq $False) {
        Write-Host ""
        Write-Host "ERROR: For a certificates creation, the -directory or -application parameter is required (see the documentation)." -ForegroundColor DarkRed
        Write-Host ""
        Stop-Transcript
        exit
    }

    Install-CertificatesOnly
}

Write-Host "> Installation as application (launcher): " -NoNewline  
if ($platform -eq "win32" -and $application -eq $True) {
    Write-Host "Installer is not supported on Windows" -ForegroundColor Magenta
} else {
    if ($application -eq $True) {
        Write-Host "Yes" -ForegroundColor Magenta
    } else {
        Write-Host "No" -ForegroundColor Magenta
    }
}
Write-Host "> Shortcut on Desktop: " -NoNewline
if ($shortcut -eq $True) {
    if ($platform -eq "linux"-and (((Test-Path "/usr/share/applications/a.v.a.t.a.r-client.desktop") -eq $True) -or ((Test-Path "$directory") -eq $False -and ((Test-Path "$env:HOME/.local/share/applications/a.v.a.t.a.r-client.desktop")-eq $True)))) {
        Write-Host "No (see the message below)" -ForegroundColor Yellow
    } elseif ($platform -eq "darwin" -and $null -ne $directory) {
        Write-Host "No (see the message below)" -ForegroundColor Yellow
    } else {
        Write-Host "Yes" -ForegroundColor Magenta
    }
} else {
    Write-Host "No" -ForegroundColor Magenta
}

Write-Host ""
# Test installer parameter (only for macOS)
if ($platform -eq "darwin" -and $application -eq $False) {
    Write-Host "> Warning:" -ForegroundColor Yellow
    Write-Host "    The -application parameter is prefered and required to automatically update" -ForegroundColor Yellow
    Write-Host "    the application. If you continue, no update version will be possible." -ForegroundColor Yellow
    Write-Host "    More information in the documentation." -ForegroundColor Yellow
    Write-Host ""
} 
If (((Test-Path "$directory") -eq $True)) {
    Write-Host "> Warning:" -ForegroundColor Yellow
    Write-Host "    An old $directory directory exists and will be removed during the installation." -ForegroundColor Yellow 
    Write-Host "    if you want to backup it, stop the installation now!" -ForegroundColor Yellow

    if ($platform -eq "linux" -and $shortcut -eq $True) {
        if ((Test-Path "/usr/share/applications/a.v.a.t.a.r-client.desktop") -eq $True) {
            Write-Host ""
            Write-Host "> Warning:" -ForegroundColor Yellow
            Write-Host "    An application shortcut already exists in the application launcher." -ForegroundColor Yellow  
            Write-Host "    The installer can't create several shortcuts for the same application." -ForegroundColor Yellow 
            Write-Host "    If you want a shortcut for this new application, you have to create a shortcut manually after the installation." -ForegroundColor Yellow 
            Write-Host "    More information in the documentation." -ForegroundColor Yellow   
            $shortcut = $False
        }
    } 
    Write-Host ""
} Elseif ($platform -eq "linux" -and $application -eq $False -and (Test-Path "$directory") -eq $False -and ((Test-Path "$env:HOME/.local/share/applications/a.v.a.t.a.r-client.desktop")-eq $True)) {
    Write-Host "> Warning:" -ForegroundColor Yellow
    Write-Host "    An application shortcut already exists in the application launcher." -ForegroundColor Yellow  
    Write-Host "    The installer can't create several shortcuts for the same application." -ForegroundColor Yellow 
    Write-Host "    If you want a shortcut for this new application, you have to create a shortcut manually after the installation." -ForegroundColor Yellow 
    Write-Host "    More information in the documentation." -ForegroundColor Yellow   
    $shortcut = $False
} Elseif ($platform -eq "linux" -and $application -eq $True -and ((Test-Path "$env:HOME/.local/share/applications/a.v.a.t.a.r-client.desktop")-eq $True)) {
    Write-Host "ERROR:" -ForegroundColor DarkRed
    Write-Host "    An application shortcut already exists in the application launcher." -ForegroundColor DarkRed  
    Write-Host "    The installer can't create several shortcuts for the same application." -ForegroundColor DarkRed 
    Write-Host "    Because you have choosed an application created by debian installer, a shortcut is mandatory." -ForegroundColor DarkRed 
    Write-Host "    If you want to modify the existing shortcut for the existing application," -ForegroundColor DarkRed 
    Write-Host "    you have to modify the shortcut manually before the installation." -ForegroundColor DarkRed 
    Write-Host "    More information in the documentation." -ForegroundColor DarkRed   
    Write-Host ""
    Stop-Transcript
    exit
} Elseif (($platform -eq "linux" -and $application -eq $True -and ((Test-Path "/usr/lib/a.v.a.t.a.r-client") -eq $True)) -or ($platform -eq "darwin" -and $application -eq $True -and ((Test-Path "/Applications/A.V.A.T.A.R-Client.app") -eq $True))) {
    Write-Host "> Warning:" -ForegroundColor Yellow
    Write-Host "    An A.V.A.T.A.R client application exists and will be removed during the installation." -ForegroundColor Yellow 
    Write-Host "    if you want to backup it, stop the installation now!" -ForegroundColor Yellow
    Write-Host ""
} 

$confirm = Read-Host -Prompt "Would you like to continue (Y/N)[Y]?"
if ([string]::IsNullOrWhiteSpace($confirm)) {
    $confirm ="Y"
}
if ($confirm.ToLower() -eq 'n') {
    Write-Host ""
    Write-Host "Bye bye, have a good day!" -ForegroundColor DarkMagenta 
    Write-Host ""
    Stop-Transcript
    exit
}

$noopenssl = $False
# Set location
$current_location = Get-Location
$package = "$current_location/dist"
Set-Location -Path $package

# Installing Electron packager
Write-Host "> Installing Electron packager, please wait..." -ForegroundColor DarkMagenta
start-process -FilePath $npm -ArgumentList "install", "--save-dev @electron/packager" -NoNewWindow -workingdirectory "." -Wait 
Write-Host "Electron packager installed" -ForegroundColor Green
Start-Sleep -Seconds 1

# Finding Electron version
Write-Host "> Electron version: " -NoNewline -ForegroundColor DarkMagenta 
$json_package = Get-Content ./package.json -Encoding utf8 | ConvertFrom-Json
$electron = $json_package.devDependencies.electron
if ($null -eq $electron ) {
    Write-Error "Enable to find the Electron version in the package.json. Exit" -ForegroundColor DarkRed
    Stop-Transcript
    exit
} else {
    $electron = $electron.Substring(1, $electron.Length-1)
    Write-Host $electron -ForegroundColor DarkRed
}

# Finding A.V.A.T.A.R version
Write-Host "> A.V.A.T.A.R client version: " -NoNewline -ForegroundColor DarkMagenta 
$json_avatar = Get-Content ./assets/config/default/Avatar.prop -Encoding utf8 | ConvertFrom-Json
$version = $json_avatar.version
if ($null -eq $version ) {
    Write-Error "Enable to find A.V.A.T.A.R client version in the Avatar.prop file. Exit" -ForegroundColor DarkRed
    Stop-Transcript
    exit
} else {
    Write-Host $version -ForegroundColor DarkRed
}

# Creating application
Write-Host "> Creating new A.V.A.T.A.R client, please wait..." -ForegroundColor DarkMagenta
start-process -FilePath $npx -ArgumentList "electron-packager", ".", "--electron-version=$electron", "--overwrite", "--icon=./avatar.ico", "--out=./output" -NoNewWindow -workingdirectory "." -Wait
Write-Host "A.V.A.T.A.R client created" -ForegroundColor Green
Start-Sleep -Seconds 1   

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

$package = "./output/$output_platform"
Start-Sleep -Seconds 1 

$ChromePath = if ($platform -eq "win32") {
    "$env:USERPROFILE/.cache/puppeteer"
} elseif ($platform -eq "linux") {
    "~/.cache/puppeteer"
} elseif ($platform -eq "darwin") {
    "$HOME/.cache/puppeteer"
}

if ((Test-Path $ChromePath) -eq $True) {
    Write-Host "> Removing old embedded Google Chrome for A.V.A.T.A.R client, please wait..." -ForegroundColor DarkMagenta
    Remove-Item "$ChromePath" -Recurse -Force
    if ((Test-Path $ChromePath) -eq $True) {
        if ($platform -eq "linux" -or $platform -eq "darwin") {
            start-process -FilePath "sudo" -ArgumentList "rm -r $ChromePath" -NoNewWindow -workingdirectory "." -Wait
        } else {
            Remove-Item "$ChromePath" -Recurse -Force
        }
    }
    Write-Host "Old embedded Google Chrome for A.V.A.T.A.R client removed" -ForegroundColor Green
}

if ($platform -eq "win32" -or $platform -eq "linux") {

    if ($application -eq $False) {

        if (-Not (Test-Path $directory)) {
            New-Item -Path "$directory" -ItemType "directory"
        } else {
            # Removing old application directory
            Write-Host "> Removing old A.V.A.T.A.R client application, please wait..." -ForegroundColor DarkMagenta
            Remove-Item "$directory" -Recurse -Force
            if ((Test-Path $directory) -eq $True) {
                if ($platform -eq "linux") {
                    start-process -FilePath "sudo" -ArgumentList "rm -r $directory" -NoNewWindow -workingdirectory "." -Wait
                } else {
                    Remove-Item "$directory" -Recurse -Force
                }
            }
            New-Item -Path "$directory" -ItemType "directory"
            Write-Host "Old A.V.A.T.A.R client application removed" -ForegroundColor Green
            Start-Sleep -Seconds 1
        }

        # Copy new version to the A.V.A.T.A.R client directory
        Set-NewApplication -folder "$package/*" -destination "$directory"

    } elseif ($platform -eq "linux" -and $application -eq $True) {

        if ((Test-Path "/usr/lib/a.v.a.t.a.r-client") -eq $True) {
            # Removing old application directory
            Write-Host "> Removing old A.V.A.T.A.R client application, please wait..." -ForegroundColor DarkMagenta
            Write-Host " "
            start-process -FilePath "sudo" -ArgumentList "apt remove a.v.a.t.a.r-client" -NoNewWindow -workingdirectory "." -Wait
            if ((Test-Path "/usr/lib/a.v.a.t.a.r-client") -eq $True) {
                start-process -FilePath "sudo" -ArgumentList "rm -r /usr/lib/a.v.a.t.a.r-client" -NoNewWindow -workingdirectory "." -Wait
            }
            Write-Host "Old A.V.A.T.A.R client application removed" -ForegroundColor Green
        }

        # Uninstalling Electron packager
        Uninstall-ElectronPackager
        # Installing Electron package
        Install-Electron -workingdirectory "$package/resources/app"

        # Installing debian installer
        Write-Host "> Installing debian installer, please wait..." -ForegroundColor DarkMagenta
        start-process -FilePath $npm -ArgumentList "install", "--save-dev electron-installer-debian" -NoNewWindow -workingdirectory "." -Wait 
        Write-Host "debian installer installed" -ForegroundColor Green
        Start-Sleep -Seconds 1

        # Creating a deb package
        Write-Host "> Creating a .deb package, please wait..." -ForegroundColor DarkMagenta
        start-process -FilePath "electron-installer-debian" -ArgumentList "--src", "$package", "--dest", "./installer/", "--arch", "amd64" -NoNewWindow -workingdirectory "." -Wait
        Write-Host "deb package created" -ForegroundColor Green
        Start-Sleep -Seconds 1   

        # Finding deb package name
        $debfolder = Get-ChildItem -Path "./installer"
        foreach ($MySubFolder in $debfolder) {
            $debpackage = $MySubFolder.name
        }
        if ($null -eq $debpackage) {
            Write-Error "Enable to find the A.V.A.T.A.R deb package. Exit" -ForegroundColor DarkRed
            Stop-Transcript
            exit
        }

        # Installing deb package
        Write-Host "> Installing A.V.A.T.A.R client application, please wait..." -ForegroundColor DarkMagenta
        Set-Location -Path "./installer"

        start-process -FilePath "sudo" -ArgumentList "apt install ./$debpackage" -NoNewWindow -workingdirectory "." -Wait
        Write-Host "A.V.A.T.A.R client application installed" -ForegroundColor Green
        Start-Sleep -Seconds 1   

        if ((Test-Path "/usr/lib/a.v.a.t.a.r-client") -eq $True) {

            # Gets owner
            $app_name = $MyInvocation.MyCommand.Name
            $user = $(Get-ChildItem $current_location/$app_name | Select-Object User,Group)
            # Changing user,group of all A.V.A.T.A.R files
            Set-Location -Path "/usr/lib/a.v.a.t.a.r-client"
            Write-Host "> Changing owner of A.V.A.T.A.R client application to $user (this may take a while)" -NoNewline -ForegroundColor DarkMagenta
            Get-ChildItem -Path "." -Recurse | ForEach-Object {sudo chown $user.User $_.FullName;sudo chgrp $user.Group $_.FullName}
            Write-Host " done" -ForegroundColor Green

            # Changing icon to shorcut
            Set-Location -Path $current_location
            Write-Host "> Update A.V.A.T.A.R client shortcut" -NoNewline -ForegroundColor DarkMagenta
            Get-Content -Path "/usr/share/applications/a.v.a.t.a.r-client.desktop" | Foreach-Object {
                $_ -replace "Name=A.V.A.T.A.R-Client", "Name=A.V.A.T.A.R Client $version" 
            } | Foreach-Object {
                $_ -replace "Comment=A.V.A.T.A.R client", "Comment=A.V.A.T.A.R Client $version" 
            } | Foreach-Object {
                $_ -replace "Icon=a.v.a.t.a.r-client", "Icon=/usr/lib/a.v.a.t.a.r-client/resources/app/avatar.ico"
            } | Set-Content "./shortcut.txt"
            
            start-process -FilePath "sudo" -ArgumentList "cp ./shortcut.txt /usr/share/applications/a.v.a.t.a.r-client.desktop" -NoNewWindow -workingdirectory "." -Wait
            Remove-Item ./shortcut.txt -Force
            Write-Host " done" -ForegroundColor Green
        } else {
            Write-Error "ERROR: Installation of the A.V.A.T.A.R client as an application failed. Exit" -ForegroundColor DarkRed
            Set-Location -Path $current_location
            Stop-Transcript
            exit
        }
    } 
    
    if ($platform -eq "win32" -or ($platform -eq "linux" -and $application -eq $False )) {
        
        # Set folder for the Electron package
        Set-Location -Path "$directory/resources/app"

        # Uninstalling Electron packager
        Uninstall-ElectronPackager
        # Installing Electron package
        Install-Electron -workingdirectory "."
    }
} else {

    $folderPath = if ($application -eq $True) {"/Applications/A.V.A.T.A.R-Client.app"} else {$directory}
    $installPath = if ($application -eq $True) {"/Applications"} else {$directory}
   
    if ((Test-Path "$folderPath") -eq $True) {
        # Removing old application
        Write-Host "> Removing old A.V.A.T.A.R client application, please wait..." -ForegroundColor DarkMagenta
        Remove-Item "$folderPath" -Recurse -Force
        if ((Test-Path "$folderPath") -eq $True) {
            start-process -FilePath "sudo" -ArgumentList "rm -r $folderPath" -NoNewWindow -workingdirectory "." -Wait
        }
        Write-Host "Old A.V.A.T.A.R client application removed" -ForegroundColor Green
    }

    # Copy new version as Application
    Set-NewApplication -folder "$package/*" -destination $installPath
    # Set folder for the Electron package
    Set-Location -Path "$folderPath/Contents/Resources/app"
    # Uninstalling Electron packager
    Uninstall-ElectronPackager
    # Installing Electron package
    Install-Electron -workingdirectory "."
    # add hostname to the /etc/hosts file
    add-hostName
}   

# Voices
if ($platform -eq "linux") {Install-Voices}

##################################
# Additional common applications #
##################################
# Installing Sox
Install-Sox
# Installing ffmpeg
Install-ffmpeg
# HTTPS certificates
if ($nocertificate -eq $false) {
    if ($null -eq $usecertificate) {
        Install-openssl
        Install-CA
    }
    Install-Hote
}

function Install-Shortcut  {

    # Create shortcut
    if ($platform -eq "win32" -and $shortcut -eq $True) {

        $DesktopPath = [Environment]::GetFolderPath('Desktop')
        $ShortcutPath = Join-Path -Path $DesktopPath -ChildPath "A.V.A.T.A.R Client $version.lnk"

        if ((Test-Path "$ShortcutPath") -eq $True) {
            Remove-Item "$ShortcutPath" -Force
        } 

        try {
            Write-Host "> Creating A.V.A.T.A.R client $version shortcut on Desktop" -NoNewline  -ForegroundColor DarkMagenta
            $Shell = New-Object -ComObject Wscript.Shell
            $DesktopShortcut = $Shell.CreateShortcut($ShortcutPath)
            $DesktopShortcut.TargetPath = "$directory\A.V.A.T.A.R-Client.exe"
            $DesktopShortcut.IconLocation = "$directory\A.V.A.T.A.R-Client.exe, 0"
            $DesktopShortcut.WorkingDirectory = "$directory"
            $DesktopShortcut.Description = "A.V.A.T.A.R Client version $version"
            $DesktopShortcut.Save()
            Write-Host " done" -ForegroundColor Green
            Start-Sleep -Seconds 1
        } catch {
            Write-Host " "
            Write-Host "Error of creation of the A.V.A.T.A.R client $version shortcut on Desktop: " -ForegroundColor DarkRed -NoNewline
        }
    } elseif ($platform -eq "linux" -and $shortcut -eq $True) {
        Write-Host "> Creating A.V.A.T.A.R client $version shortcut in the application launcher" -NoNewline  -ForegroundColor DarkMagenta
        $desktopFile = "$env:HOME/.local/share/applications/a.v.a.t.a.r-client.desktop"
        "[Desktop Entry]" | Out-File -FilePath $desktopFile
        "Name=A.V.A.T.A.R Client $version" | Out-File -FilePath $desktopFile -Append
        "Comment=A.V.A.T.A.R Client $version" | Out-File -FilePath $desktopFile -Append
        "GenericName=A.V.A.T.A.R Client $version" | Out-File -FilePath $desktopFile -Append
        "Exec=$directory/A.V.A.T.A.R-Client %U" | Out-File -FilePath $desktopFile -Append
        "Icon=$directory/resources/app/avatar.ico" | Out-File -FilePath $desktopFile -Append
        "Type=Application" | Out-File -FilePath $desktopFile -Append
        "StartupNotify=true" | Out-File -FilePath $desktopFile -Append
        "Categories=GNOME;GTK;Utility;" | Out-File -FilePath $desktopFile -Append
        Write-Host " done" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }

}

$ErrorActionPreference = "Ignore"
# Last thing, create shortcut
Install-Shortcut 

# Reset directory location
Set-Location -Path $current_location

Write-Host ""
Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
Write-Host "█       A.V.A.T.A.R client installation has been successfully completed!       █" -ForegroundColor DarkMagenta
Write-Host "█  Launch the application and open the documentation to define the properties. █" -ForegroundColor DarkMagenta
Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
Write-Host "█                                  Have fun !                                  █" -ForegroundColor DarkMagenta
Write-Host "█                                                                              █" -ForegroundColor DarkMagenta
Write-Host "■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■" -ForegroundColor DarkMagenta
