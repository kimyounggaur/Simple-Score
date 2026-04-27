# Simple Score Deploy Guide

Simple Score는 파일 기반 DB와 세션 비밀키를 사용하므로 Docker 또는 Persistent Disk가 있는 환경에 배포하는 편이 안정적입니다.

## 권장 배포 방식

- Render Docker Web Service
- Ubuntu VPS + Docker
- Coolify, Railway 같은 Docker 배포 서비스

## 로컬에서 프로덕션 테스트

```bash
npm run build
npm run start:prod
```

기본 주소:

```text
http://127.0.0.1:3017
```

## Docker로 실행

```bash
docker build -t simple-score-web .
docker run -d ^
  --name simple-score-web ^
  -p 3017:3017 ^
  -v simple_score_data:/app/data ^
  -e NODE_ENV=production ^
  -e PORT=3017 ^
  -e HOSTNAME=0.0.0.0 ^
  -e LESSON_DESIGNER_DATA_DIR=/app/data ^
  simple-score-web
```

macOS 또는 Linux에서는 줄바꿈 기호 `^` 대신 `\`를 사용하면 됩니다.

## Render 배포

이 저장소는 Render Blueprint 기준으로 준비되어 있습니다.

- Blueprint 파일: `render.yaml`
- Health check: `/api/health`
- Persistent Disk mount path: `/app/data`
- 내부 포트: `10000`

### Render에서 확인할 값

아래 환경변수를 Render Dashboard 또는 Blueprint에서 입력합니다.

```text
NEXT_PUBLIC_APP_URL=https://your-domain.onrender.com
APP_URL=https://your-domain.onrender.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe Dashboard 설정

1. Product를 생성합니다.
2. 월간 또는 원하는 결제 Price를 생성합니다.
3. Price ID를 `STRIPE_PRICE_ID`에 입력합니다.
4. Webhook endpoint를 아래 주소로 생성합니다.

```text
https://your-domain.onrender.com/api/webhooks/stripe
```

권장 이벤트:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### 배포 후 확인 순서

1. `/setup/admin`에서 첫 관리자 계정을 생성합니다.
2. `/admin`에서 Stripe 설정 상태 패널을 확인합니다.
3. 일반 회원 계정을 하나 만든 뒤 로그인합니다.
4. 헤더의 `업그레이드` 버튼이 Checkout으로 이동하는지 확인합니다.
5. 결제 후 돌아오면 `상태 새로고침`으로 권한 반영을 확인합니다.

## 운영 체크리스트

- Disk mount path가 `/app/data`로 연결되어 있는지
- `NEXT_PUBLIC_APP_URL`과 실제 도메인이 일치하는지
- Webhook endpoint가 올바른지
- Stripe signing secret이 정확한지
- Render 배포 로그에 `502` 또는 `permission denied`가 없는지

## 참고 문서

- [Render Web Services](https://render.com/docs/web-services)
- [Render Persistent Disks](https://render.com/docs/disks)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)
