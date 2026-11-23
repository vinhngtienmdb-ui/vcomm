#!/usr/bin/env bash
# Dựng máy ảo môi trường thật VComm (CONG_VIEC_76, THAY_DOI_42, tài liệu 26 mục 5).
# Máy: Oracle Cloud Always Free, Ampere A1 (arm64), Ubuntu 24.04, vùng Singapore.
# Chạy một lần bằng quyền root ngay sau khi tạo máy (hoặc khi dựng lại máy sau khi bị thu hồi):
#   sudo bash cai-dat-may-ao.sh "<khóa công khai SSH của người dùng triển khai>"
# Chạy lại được nhiều lần (không làm hỏng cài đặt đã có).
# Không mở cổng vào nào: truy cập web và SSH đều qua Cloudflare Tunnel (container cloudflared trong compose).
set -euo pipefail

deploy_user="trien-khai"
deploy_directory="/opt/vcomm"
deploy_public_key="${1:?Cần khóa công khai SSH của người dùng triển khai (tham số 1)}"

[ "$(id -u)" = "0" ] || { echo "Chạy bằng root (sudo)."; exit 1; }
[ "$(dpkg --print-architecture)" = "arm64" ] || echo "Cảnh báo: máy không phải arm64; ảnh VComm build cho arm64."

echo "== Cập nhật hệ thống, gói cần thiết"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q ca-certificates curl gnupg ufw unattended-upgrades chrony

echo "== Cập nhật bảo mật tự động, tự khởi động lại lúc 3 giờ sáng giờ Việt Nam khi cần"
timedatectl set-timezone Asia/Ho_Chi_Minh
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat > /etc/apt/apt.conf.d/52vcomm-unattended-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades chrony

echo "== Tường lửa: chặn mọi kết nối vào, cho phép đi ra"
# Oracle Ubuntu có sẵn quy tắc iptables mở cổng 22; ufw thay bằng chặn hết.
# SSH vẫn dùng được qua Cloudflare Tunnel vì cloudflared nối từ mạng Docker vào cổng 22 của máy (cho phép từ dải Docker).
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow from 172.16.0.0/12 to any port 22 proto tcp comment "SSH qua cloudflared trong Docker"
ufw --force enable
# Quy tắc iptables mặc định của ảnh Oracle (/etc/iptables/rules.v4) mở cổng 22 ra ngoài: bỏ để ufw quyết định.
if [ -f /etc/iptables/rules.v4 ]; then
  cp -n /etc/iptables/rules.v4 /etc/iptables/rules.v4.goc || true
  printf '*filter\n:INPUT ACCEPT [0:0]\n:FORWARD ACCEPT [0:0]\n:OUTPUT ACCEPT [0:0]\nCOMMIT\n' > /etc/iptables/rules.v4
fi

echo "== SSH: chỉ đăng nhập bằng khóa, không cho root"
cat > /etc/ssh/sshd_config.d/50-vcomm.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
X11Forwarding no
AllowTcpForwarding no
EOF
systemctl reload ssh || systemctl reload sshd

echo "== Docker Engine, plugin compose (kho chính thức của Docker)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
cat > /etc/docker/daemon.json <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" }, "live-restore": true }
EOF
systemctl enable docker && systemctl restart docker

echo "== Bộ nhớ hoán đổi 4 GB"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Người dùng triển khai $deploy_user (chỉ khóa SSH, thuộc nhóm docker)"
# Lưu ý: nhóm docker tương đương quyền root trên máy; khóa SSH của người dùng này chỉ để trong biến bí mật GitHub.
id "$deploy_user" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$deploy_user"
usermod -aG docker "$deploy_user"
passwd -l "$deploy_user" >/dev/null
install -d -m 700 -o "$deploy_user" -g "$deploy_user" "/home/$deploy_user/.ssh"
printf '%s\n' "$deploy_public_key" > "/home/$deploy_user/.ssh/authorized_keys"
chown "$deploy_user:$deploy_user" "/home/$deploy_user/.ssh/authorized_keys" && chmod 600 "/home/$deploy_user/.ssh/authorized_keys"

echo "== Thư mục triển khai $deploy_directory"
install -d -m 750 -o "$deploy_user" -g "$deploy_user" "$deploy_directory" "$deploy_directory/certificates"
if [ ! -f "$deploy_directory/.env" ]; then
  install -m 600 -o "$deploy_user" -g "$deploy_user" /dev/null "$deploy_directory/.env"
  echo "Đã tạo $deploy_directory/.env rỗng (quyền 600): điền theo infra/compose/env.production.example."
fi

echo "== Xong. Việc tiếp theo (tài liệu 26 mục 5):"
echo "  1. Điền $deploy_directory/.env, đặt chứng chỉ gốc Supabase vào $deploy_directory/certificates/supabase-ca.crt."
echo "  2. Chạy luồng GitHub Actions \"Triển khai\" (chép tệp compose, migration, khởi động)."
echo "  3. Biến GitHub DEPLOY_SSH_KNOWN_HOSTS (ghim khóa máy):"
echo "     $(ssh-keyscan -t ed25519 localhost 2>/dev/null | sed 's/^localhost/ssh.vcomm.vn/')"
