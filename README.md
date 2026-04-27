# Simple Score

Simple Score는 교육용 악보 작업 웹앱입니다. Next.js 기반으로 동작하며 회원가입, 회원 로그인, 관리자 로그인, 관리자 페이지, 파일 기반 사용자 DB, 기본 보안 설정을 포함합니다.

## 기술 스택

- Next.js 16
- React 19
- Stripe
- Docker
- Render

## 로컬 실행

```bash
npm install
npm run dev
```

기본 접속 주소:

```text
http://127.0.0.1:3017
```

## 프로덕션 빌드

```bash
npm run build
npm run start:prod
```

## 주요 기능

- 회원가입 / 회원 로그인 / 관리자 로그인
- 편집기형 랜딩페이지
- 관리자 사용자 관리
- 이용 등급 관리
- Stripe 결제 연동 준비
- HttpOnly 세션 쿠키
- 보안 헤더 적용

## 데이터 저장 위치

기본적으로 아래 경로에 데이터가 저장됩니다.

- `data/app-db.json`
- `data/.session-secret`

Render에서는 mounted disk를 `/app/data`에 연결하도록 구성되어 있습니다.

## 결제 기능 설정

결제는 Stripe Checkout, Customer Portal, Webhook 기준으로 연결됩니다.

### 1. 환경변수

아래 값을 Render 환경변수에 입력합니다.

```text
NEXT_PUBLIC_APP_URL=https://your-domain.onrender.com
APP_URL=https://your-domain.onrender.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

로컬 예시는 [`.env.example`](./.env.example)에 있습니다.

### 2. Stripe Dashboard에서 만들 것

1. Product 1개 생성
2. 월간 또는 원하는 과금 Price 생성
3. Price ID를 `STRIPE_PRICE_ID`에 입력
4. Webhook endpoint 생성

Webhook endpoint URL:

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

### 3. 관리자 화면 확인

관리자 로그인 후 `/admin`으로 들어가면 Stripe 설정 상태가 보입니다.

- 앱 URL
- 비밀키
- Price ID
- Webhook secret

이 네 가지가 모두 채워져야 실제 결제 검증으로 넘어갈 수 있습니다.

## Render 배포

- Blueprint 파일: `render.yaml`
- Health check: `/api/health`
- Persistent Disk mount path: `/app/data`

자세한 배포 설명은 [`DEPLOY.md`](./DEPLOY.md)를 참고하세요.

## 첫 운영 순서

1. Render 배포 완료
2. `/setup/admin`에서 첫 관리자 계정 생성
3. `/admin`에서 Stripe 설정 상태 확인
4. 환경변수 입력 후 재배포
5. Stripe webhook 연결
6. 회원 계정으로 업그레이드 버튼 테스트
