# Lesson Designer

교육용 악보 작업 웹앱입니다. Next.js 기반으로 동작하며 회원가입, 회원 로그인, 관리자 로그인, 관리자 페이지, 가입자 DB, 기본 보안 설정이 포함되어 있습니다.

## 기술 스택

- Next.js 16
- React 19
- Docker
- Render Blueprint

## 로컬 실행

```bash
npm install
npm run dev
```

기본 접속 주소:

```text
http://127.0.0.1:3017/auth
```

## 프로덕션 빌드

```bash
npm run build
npm run start:prod
```

## 주요 기능

- 회원가입 / 회원 로그인
- 관리자 로그인
- 관리자 대시보드
- 가입자 파일 DB 저장
- HttpOnly 세션 쿠키
- 보안 헤더 적용
- 로그인 시도 제한

## 데이터 저장

기본적으로 아래 경로에 데이터가 저장됩니다.

- `data/app-db.json`
- `data/.session-secret`

운영 환경에서는 이 경로를 영구 스토리지에 연결해야 합니다.

## Render 배포

이 프로젝트는 Render Docker Web Service 배포를 기준으로 준비되어 있습니다.

- Blueprint 파일: `render.yaml`
- Health check: `/api/health`
- Persistent Disk mount path: `/app/data`

자세한 내용은 [DEPLOY.md](D:\256G 1\01 레슨디자이너-반응형 웹사이트\악보 디자이너\교육용 악보작업 웹앱17\DEPLOY.md) 를 참고하세요.

## 첫 운영 순서

1. 배포 완료
2. `/setup/admin` 접속
3. 첫 관리자 계정 생성
4. `/auth`에서 회원가입/로그인 테스트
