# Lesson Designer Deploy Guide

이 프로젝트는 회원 DB와 세션 비밀키를 로컬 파일로 저장합니다. 그래서 정적 호스팅이나 서버리스보다 Docker 또는 VPS 배포가 더 잘 맞습니다.

## 권장 배포 방식

- Docker 단독 실행
- Docker Compose
- Ubuntu VPS + Nginx reverse proxy
- Railway, Render, Coolify 같은 Docker 배포 서비스

## 1. 로컬에서 프로덕션 실행 테스트

```bash
npm run build
npm run start:prod
```

접속:

```text
http://서버IP:3017
```

## 2. Docker로 배포

이미지 빌드:

```bash
docker build -t lesson-designer-web .
```

컨테이너 실행:

```bash
docker run -d ^
  --name lesson-designer-web ^
  -p 3017:3017 ^
  -v lesson_designer_data:/app/data ^
  -e NODE_ENV=production ^
  -e PORT=3017 ^
  -e HOSTNAME=0.0.0.0 ^
  -e LESSON_DESIGNER_DATA_DIR=/app/data ^
  lesson-designer-web
```

리눅스/macOS에서는 줄바꿈 기호 `^` 대신 `\`를 사용합니다.

## 3. Docker Compose로 배포

```bash
docker compose up -d --build
```

이 설정은 가입자 DB와 세션 비밀키를 Docker 볼륨 `lesson_designer_data`에 유지합니다.

## 4. Ubuntu 서버에서 Nginx 연결

Nginx는 80 또는 443 포트에서 받고, 앱은 내부에서 3017 포트로 유지하는 구성이 편합니다.

예시:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3017;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

HTTPS는 `certbot`으로 붙이면 됩니다.

## 5. 배포 전 체크

- 도메인 연결 여부
- 서버 방화벽에서 80, 443 허용
- 리버스 프록시 사용 시 3017은 외부에 직접 열지 않아도 됨
- `data` 경로가 영구 저장소에 연결되어 있는지 확인
- 첫 접속 후 `/setup/admin`에서 관리자 계정 생성

## 6. 주의 사항

- 이 프로젝트는 현재 파일 기반 DB입니다.
- 여러 인스턴스를 동시에 띄우는 오토스케일 환경에는 적합하지 않습니다.
- 대규모 운영 전에는 SQLite/PostgreSQL 같은 외부 DB로 전환하는 것이 좋습니다.

## 7. 첫 운영 순서

1. 앱 배포
2. 도메인 연결
3. `https://your-domain.com/setup/admin` 접속
4. 첫 관리자 계정 생성
5. `https://your-domain.com/auth`에서 회원가입/로그인 테스트

## Render 배포

이 프로젝트는 Render에서 Docker 기반 Web Service로 배포하는 구성이 가장 잘 맞습니다.

주의:

- Render의 파일시스템은 기본적으로 ephemeral 입니다.
- 가입자 DB와 세션 비밀키를 유지하려면 Persistent Disk를 연결해야 합니다.
- Render 문서 기준으로 Persistent Disk는 유료 Web Service에서 사용할 수 있습니다.

공식 문서:

- Persistent Disk: https://render.com/docs/disks
- Web Services: https://render.com/docs/web-services
- Blueprint: https://render.com/docs/blueprint-spec

### 가장 쉬운 방식

1. GitHub에 이 프로젝트를 올립니다.
2. Render에서 `New +` -> `Blueprint`를 선택합니다.
3. 저장소를 연결합니다.
4. 루트의 `render.yaml`을 읽어서 서비스 구성을 불러옵니다.
5. 첫 배포 후 도메인을 연결합니다.
6. `https://your-domain.com/setup/admin`에서 첫 관리자 계정을 생성합니다.

### 이 프로젝트의 Render 구성

- Runtime: Docker
- Health check: `/api/health`
- 내부 데이터 경로: `/app/data`
- 외부 포트: `10000`
- 앱 데이터 보존: Persistent Disk 마운트 `/app/data`

### Render Dashboard에서 확인할 것

- 서비스 플랜이 디스크 연결 가능한 유료 플랜인지
- Disk mount path가 `/app/data`로 설정되어 있는지
- 첫 배포 후 로그에 포트 바인딩 오류가 없는지
- Custom Domain 연결 후 HTTPS가 정상 발급되었는지

### Render에서 권장하는 다음 단계

- 현재 파일 DB 대신 Render Postgres로 전환
- 관리자용만 접근 가능한 운영 IP 제한 또는 내부 운영 정책 적용
- Custom Domain + HTTPS 강제 확인
