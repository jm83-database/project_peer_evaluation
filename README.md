# 프로젝트 동료 평가 시스템

다수의 교육 과정(코호트)에서 동시에 사용할 수 있는 프로젝트 팀원 동료 평가 웹 애플리케이션.

## 주요 기능

### 공통
- 서버 현재 시간(KST) 표시 (로그인 화면, 학생/관리자 헤더에서 확인 가능, 1분마다 자동 갱신)
- 좌측 하단 **?** 버튼으로 사용 가이드 확인 (로그인 전에도 표시)

### 학생
- 이름 + 비밀번호만으로 로그인 (교육 과정 자동 감지)
- 본인을 제외한 팀원에 대해 매일 5점 척도 평가
  - 회의 참석 여부
  - 실질 기여 여부
  - 참여 성실도 (반복 미참여)
- **1일 1회 제출, 제출 후 수정 불가** (비공개 평가 보장)
- 제출 직후 5초간 결과 확인 후 자동으로 가려짐
- 재로그인해도 이전 평가 내용 확인 불가
- 다음 날 자동으로 새 평가 폼 제공 (별도 초기화 불필요)

### 관리자
- **과정 관리**: 코호트 추가/비활성화, `students.json` 업로드, 과정별 등록 학생 수 확인
- **프로젝트 관리**: 프로젝트 생성, 팀 구성 (드래그앤드롭 + 균등 배분)
- **대시보드**: 일간/주간/월간 뷰 전환, 제출 현황 도넛 차트, 팀별/학생별 평균 바 차트, 기간별 추세 라인 차트, 학생 상세 일별 추이, CSV 다운로드
- 대시보드에서 **평가자별 상세 점수 열람 가능** (학생 간에는 익명)

## 기술 스택

- **Backend**: Flask 3.0, Python 3.10+
- **Frontend**: React 17 (CDN), Tailwind CSS, Chart.js v4
- **Database**: Azure Cosmos DB (로컬 개발 시 JSON 파일 자동 fallback)
- **배포**: Azure Web App

## 프로젝트 구조

```
project_peer_evaluation/
├── app.py              # Flask 앱 + 모든 API 라우트
├── cosmos_service.py   # Cosmos DB / JSON 이중 저장소
├── requirements.txt    # Python 의존성
├── .env.example        # 환경변수 템플릿
├── .gitignore
├── data/               # 로컬 JSON 데이터 (gitignore 대상)
├── templates/
│   └── index.html      # React SPA 쉘
└── static/js/
    └── main.js         # React 컴포넌트
```

---

## 로컬 개발 환경 설정

### 1. 의존성 설치

```bash
cd project_peer_evaluation
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 최소한 다음 값을 설정:

```env
TEACHER_PASSWORD=원하는관리자비밀번호
SECRET_KEY=랜덤문자열
```

> Cosmos DB 환경변수를 설정하지 않으면 `data/` 디렉토리에 JSON 파일로 자동 저장됩니다.

### 3. 실행

```bash
python app.py
```

브라우저에서 `http://localhost:8001` 접속.

### 4. 초기 데이터 등록

1. 관리자 로그인 (기본 비밀번호: `.env`의 `TEACHER_PASSWORD`)
2. **과정 관리** 탭에서 코호트 생성 (예: `DT4` / `MS Data 4기`)
3. `students.json` 파일 업로드
4. **프로젝트 관리** 탭에서 프로젝트 생성 및 팀 구성

---

## Azure Cosmos DB 연동

### 1. Cosmos DB 리소스 생성

Azure Portal에서:

1. **Azure Cosmos DB 계정** 생성 (API: **NoSQL**)
2. **데이터베이스** 생성 (예: `peer-evaluation-db`)
3. **컨테이너** 생성:
   - 컨테이너 이름: `peer-evaluation` (또는 원하는 이름)
   - 파티션 키: `/cohort_id`
   - 처리량: 400 RU/s (Serverless 선택 시 자동)

### 2. 연결 정보 확인

Azure Portal → Cosmos DB 계정 → **키** 메뉴에서:

| 항목 | 환경변수 |
|------|----------|
| URI | `COSMOS_ENDPOINT` |
| PRIMARY KEY | `COSMOS_KEY` |
| 데이터베이스 이름 | `COSMOS_DB` |
| 컨테이너 이름 | `COSMOS_CONTAINER` |

### 3. 환경변수 설정

```env
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your-primary-key==
COSMOS_DB=peer-evaluation-db
COSMOS_CONTAINER=peer-evaluation
```

### 4. 데이터 구조

Cosmos DB에 저장되는 문서 형식:

| 문서 ID | 파티션 키 | 설명 |
|---------|-----------|------|
| `peer_eval_cohorts` | `system` | 전체 코호트 목록 |
| `{cohort_id}_students` | `{cohort_id}` | 코호트별 학생 목록 |
| `{cohort_id}_projects` | `{cohort_id}` | 코호트별 프로젝트/팀 구성 |
| `{cohort_id}_evaluations` | `{cohort_id}` | 코호트별 평가 데이터 |

> Cosmos DB 환경변수가 없으면 동일한 구조의 JSON 파일이 `data/` 디렉토리에 자동 생성됩니다.

---

## Azure Web App 배포

### 방법 1: Azure CLI로 배포

```bash
# Azure 로그인
az login

# 리소스 그룹 생성 (이미 있으면 생략)
az group create --name rg-peer-eval --location koreacentral

# App Service Plan 생성 (B1 이상 권장)
az appservice plan create \
  --name plan-peer-eval \
  --resource-group rg-peer-eval \
  --sku B1 \
  --is-linux

# Web App 생성
az webapp create \
  --name peer-eval-app \
  --resource-group rg-peer-eval \
  --plan plan-peer-eval \
  --runtime "PYTHON:3.11"

# 환경변수 설정
az webapp config appsettings set \
  --name peer-eval-app \
  --resource-group rg-peer-eval \
  --settings \
    COSMOS_ENDPOINT="https://your-account.documents.azure.com:443/" \
    COSMOS_KEY="your-primary-key==" \
    COSMOS_DB="peer-evaluation-db" \
    COSMOS_CONTAINER="peer-evaluation" \
    TEACHER_PASSWORD="your-admin-password" \
    SECRET_KEY="your-random-secret-key" \
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"

# 시작 명령어 설정
az webapp config set \
  --name peer-eval-app \
  --resource-group rg-peer-eval \
  --startup-file "gunicorn --bind=0.0.0.0:8000 app:app"

# 소스코드 배포
az webapp up \
  --name peer-eval-app \
  --resource-group rg-peer-eval
```

### 방법 2: GitHub Actions CI/CD

1. Azure Portal → Web App → **배포 센터** → GitHub 연결
2. 리포지토리와 브랜치 선택
3. Azure가 자동으로 `.github/workflows/` 파일 생성
4. Web App의 **구성** → **애플리케이션 설정**에서 환경변수 추가

### 방법 3: VS Code Azure 확장

1. VS Code에서 **Azure App Service** 확장 설치
2. Azure 로그인
3. 프로젝트 폴더 우클릭 → **Deploy to Web App**
4. 지시에 따라 진행

### 배포 후 확인사항

- `https://peer-eval-app.azurewebsites.net` 접속
- 관리자 로그인 후 코호트/학생 데이터 정상 로드 확인
- Azure Portal → Cosmos DB → **데이터 탐색기**에서 문서 생성 확인
- **진단 및 문제 해결** 메뉴에서 로그 확인: `az webapp log tail --name peer-eval-app --resource-group rg-peer-eval`

---

## students.json 형식

```json
[
    {
        "id": 1,
        "name": "홍길동",
        "password": "1234"
    },
    {
        "id": 2,
        "name": "김철수",
        "password": "5678"
    }
]
```

기존 출석 시스템의 `students.json`을 그대로 사용할 수 있습니다 (`present`, `code`, `timestamp` 필드는 무시됨).

---

## 보안

| 항목 | 설명 |
|------|------|
| **비밀번호 해시** | 학생 비밀번호는 업로드 시 `werkzeug` PBKDF2 해시로 변환되어 저장됩니다. 평문 비밀번호는 저장되지 않습니다. |
| **로그인 Rate Limit** | 학생/관리자 로그인 엔드포인트에 IP당 **5회/분** 제한이 적용됩니다 (`flask-limiter`). |
| **세션 만료** | 로그인 세션은 **1시간** 후 자동 만료됩니다. |
| **API 인증** | 학생 목록 조회를 포함한 모든 데이터 API는 관리자 또는 학생 세션 인증이 필요합니다. |
| **평가 대상 검증** | 평가 제출 시 `target_id`가 본인 팀원인지 서버사이드에서 검증합니다. |
| **보안 헤더** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` 헤더가 모든 응답에 포함됩니다. |
| **파일 업로드 제한** | 업로드 파일 크기는 최대 **1MB**로 제한됩니다. |
| **입력값 검증** | 대시보드 날짜 파라미터는 `YYYY-MM-DD` 형식으로 검증됩니다. |

> **참고**: 기존에 평문으로 저장된 학생 데이터가 있다면, `students.json`을 다시 업로드해야 해시된 비밀번호로 갱신됩니다.

---

## 평가 비공개 정책

학생의 평가 내용이 유출되지 않도록 다음과 같은 보호 장치가 적용되어 있습니다:

| 항목 | 동작 |
|------|------|
| 제출 후 수정 | 불가 (1일 1회 제출, 서버에서 재제출 거부) |
| 제출 후 확인 | 5초간 결과 표시 후 자동 가림 |
| 재로그인 시 | "평가 완료" 메시지만 표시, 점수 데이터 미반환 |
| 다음 날 | 자동으로 새 평가 폼 제공 (날짜 기준 초기화) |
| 학생 간 열람 | 불가 (익명 처리) |
| 관리자 열람 | 가능 (대시보드에서 평가자별 상세 확인) |

---

## API Reference

모든 API는 `/api` 하위 경로에 위치하며, JSON 형식으로 요청/응답합니다.

### 서버 시간

| Method | Endpoint | Auth | 설명 |
|--------|----------|------|------|
| `GET` | `/api/server-time` | - | 서버 현재 시간 (KST) |

**응답 예시:**
```json
{"datetime": "2026-03-18 15:30:22", "date": "2026-03-18", "time": "15:30"}
```

### 인증 (Auth)

| Method | Endpoint | Auth | 설명 | Request Body |
|--------|----------|------|------|-------------|
| `POST` | `/api/auth/login` | - | 학생 로그인 (Rate Limit: 5회/분) | `{name, password}` |
| `POST` | `/api/auth/admin-login` | - | 관리자 로그인 | `{password}` |
| `POST` | `/api/auth/logout` | any | 로그아웃 | - |
| `GET` | `/api/auth/status` | any | 세션 상태 확인 | - |

**응답 예시 (학생 로그인 성공):**
```json
{"success": true, "student_id": 1, "student_name": "홍길동", "cohort_id": "DT4"}
```
> `cohort_id`는 서버에서 이름+비밀번호 매칭으로 자동 감지되어 반환됩니다. 활성 과정만 검색 대상입니다.

### 코호트 (Cohort)

| Method | Endpoint | Auth | 설명 | Request Body / Params |
|--------|----------|------|------|-----------------------|
| `GET` | `/api/cohorts` | any | 코호트 목록 (학생 수 포함) | `?active_only=true` (선택) |
| `POST` | `/api/cohorts` | admin | 코호트 생성 | `{cohort_id, name}` |
| `PUT` | `/api/cohorts/<cohort_id>` | admin | 코호트 수정 | `{name?, active?}` |
| `DELETE` | `/api/cohorts/<cohort_id>` | admin | 코호트 비활성화 | - |

### 학생 (Students)

| Method | Endpoint | Auth | 설명 | Request Body |
|--------|----------|------|------|-------------|
| `GET` | `/api/cohorts/<cid>/students` | admin | 학생 전체 목록 | - |
| `GET` | `/api/cohorts/<cid>/students/names` | admin | 학생 id+name 목록 | - |
| `POST` | `/api/cohorts/<cid>/students/upload` | admin | 학생 데이터 업로드 | JSON 파일 (`multipart/form-data`) 또는 `{students: [...]}` |

**업로드 JSON 형식:**
```json
[{"id": 1, "name": "홍길동", "password": "1234"}, ...]
```

### 프로젝트 & 팀 (Projects & Teams)

| Method | Endpoint | Auth | 설명 | Request Body |
|--------|----------|------|------|-------------|
| `GET` | `/api/cohorts/<cid>/projects` | admin | 프로젝트 목록 | - |
| `POST` | `/api/cohorts/<cid>/projects` | admin | 프로젝트 생성 | `{name, start_date, end_date, teams, unassigned}` |
| `PUT` | `/api/cohorts/<cid>/projects/<pid>` | admin | 프로젝트 수정 | `{name?, start_date?, end_date?, teams?, unassigned?}` |
| `DELETE` | `/api/cohorts/<cid>/projects/<pid>` | admin | 프로젝트 삭제 | - |
| `PUT` | `/api/cohorts/<cid>/projects/<pid>/activate` | admin | 활성 프로젝트 전환 | - |

**teams 구조:**
```json
[
  {"team_id": 1, "name": "팀 1", "member_ids": [1, 5, 10]},
  {"team_id": 2, "name": "팀 2", "member_ids": [2, 6, 11]}
]
```

> 새 프로젝트 생성 시 기존 프로젝트는 자동 비활성화됩니다.

### 평가 (Evaluations) - 학생용

| Method | Endpoint | Auth | 설명 |
|--------|----------|------|------|
| `GET` | `/api/evaluation/my-team` | student | 내 팀원 목록 (본인 제외, 활성 프로젝트 기준) |
| `GET` | `/api/evaluation/today` | student | 오늘 제출 여부 확인 (**점수 미반환**) |
| `POST` | `/api/evaluation/submit` | student | 오늘 평가 제출 (**1일 1회, 재제출 불가**) |

**제출 Request Body:**
```json
{
  "evaluations": [
    {"target_id": 2, "meeting_attendance": 4, "contribution": 3, "repeated_absence": 5},
    {"target_id": 3, "meeting_attendance": 5, "contribution": 4, "repeated_absence": 4}
  ]
}
```
- 각 항목: 1~5 정수 (1=매우 부족, 5=매우 우수)
- `evaluator_id`는 세션에서 자동 파생 (클라이언트 조작 불가)

**`/api/evaluation/today` 응답 (제출 전):**
```json
{"success": true, "has_submitted": false}
```

**`/api/evaluation/today` 응답 (제출 후):**
```json
{"success": true, "has_submitted": true, "submitted_at": "2026-03-18T15:30:22"}
```
> 점수 데이터는 반환되지 않습니다 (비공개 정책).

### 대시보드 (Dashboard) - 관리자용

| Method | Endpoint | Auth | 설명 | Query Params |
|--------|----------|------|------|-------------|
| `GET` | `/api/admin/<cid>/dashboard/summary` | admin | 학생별 평균 점수 집계 | `project_id`, `start_date`, `end_date` |
| `GET` | `/api/admin/<cid>/dashboard/team-summary` | admin | 팀별 평균 점수 집계 | `project_id`, `start_date`, `end_date` (또는 `date`) |
| `GET` | `/api/admin/<cid>/dashboard/completion` | admin | 제출/미제출 현황 | `project_id`, `start_date`, `end_date` (또는 `date`) |
| `GET` | `/api/admin/<cid>/dashboard/trend` | admin | 일별 평균 점수 추이 | `project_id`, `start_date`, `end_date` |
| `GET` | `/api/admin/<cid>/dashboard/detail` | admin | 특정 학생 상세 (평가자별, 일별 추이) | `project_id`, `target_id` |
| `GET` | `/api/admin/<cid>/dashboard/download` | admin | CSV 내보내기 | `project_id` |

**summary 응답 예시:**
```json
[
  {
    "student_id": 2,
    "student_name": "김철수",
    "eval_count": 12,
    "meeting_attendance_avg": 3.5,
    "contribution_avg": 2.8,
    "repeated_absence_avg": 4.2,
    "overall_avg": 3.5
  }
]
```
> 종합 평균(`overall_avg`) 낮은 순으로 정렬됩니다.

**detail 응답 예시:**
```json
{
  "student_name": "김철수",
  "details": [
    {"date": "2026-03-18", "evaluator_id": 1, "evaluator_name": "홍길동", "meeting_attendance": 4, "contribution": 3, "repeated_absence": 5}
  ],
  "trend": [
    {"date": "2026-03-18", "meeting_attendance_avg": 4.0, "contribution_avg": 3.0, "repeated_absence_avg": 5.0}
  ]
}
```

**trend 응답 예시:**
```json
[
  {
    "date": "2026-03-17",
    "meeting_attendance_avg": 4.0,
    "contribution_avg": 3.5,
    "repeated_absence_avg": 4.2,
    "overall_avg": 3.9,
    "eval_count": 15,
    "submitter_count": 8
  }
]
```
> `start_date` ~ `end_date` 범위 내 평가 데이터가 있는 날짜만 반환됩니다. 주간/월간 뷰에서 추세 라인 차트에 사용됩니다.

**completion 응답 예시:**
```json
{
  "submitted": [{"id": 1, "name": "홍길동"}],
  "not_submitted": [{"id": 2, "name": "김철수"}],
  "total": 10,
  "submitted_count": 5
}
```
> `start_date`/`end_date`를 전달하면 해당 기간 내 1회 이상 제출한 학생을 집계합니다.

### Auth 권한 레벨

| 레벨 | 설명 | 적용 방식 |
|------|------|-----------|
| `-` | 인증 불필요 | 로그인 화면 관련 |
| `any` | 아무 세션이나 가능 | 로그아웃, 상태 확인 |
| `student` | 학생 세션 필요 | 평가 관련 (cohort_id, student_id 세션에서 파생) |
| `admin` | 관리자 세션 필요 | 코호트/프로젝트/대시보드 관리 |

### 공통 에러 응답

```json
{"success": false, "message": "에러 내용"}
```
- `400`: 이미 제출된 평가 재제출 시도, 유효하지 않은 평가 대상, 잘못된 날짜 형식
- `403`: 권한 부족 (세션 없음 또는 권한 불일치)
- `404`: 존재하지 않는 리소스
- `429`: 로그인 시도 횟수 초과 (5회/분)

---

## 관리자 기본 비밀번호

환경변수 `TEACHER_PASSWORD`로 설정합니다. 미설정 시 `.env.example`의 기본값을 사용합니다.
