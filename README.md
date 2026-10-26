# 하루 단어

일본어 단어를 공부하고 학습 기록을 이어가는 개인용 단어장입니다.

- **뜻 보기 · Z**: 한국어 뜻을 켜거나 끕니다.
- **읽는 법 보기 · X**: 후리가나와 글자별 한자 설명을 함께 켜거나 끕니다. `Esc`나 설명창의 닫기 버튼으로도 끌 수 있습니다.
- 다음 단어로 넘어가면 뜻과 읽기 도움은 다시 숨겨집니다.

현재 원문과 배포 학습 항목 모두 4,785개를 수록합니다. 한자 1,081자(유의어 표현·반복 부호 포함)에 글자 구성과 형성 정보를 제공합니다. 역사적 어원이 확인된 항목과 자형 구성만 설명하는 항목을 구분합니다. 좁거나 낮은 화면에서는 단어 옆의 설명 열을 스크롤할 수 있습니다.

한자 설명창에는 **구성**(각 요소의 훈·음과 변형 부수의 원래 글자)과 **형성 원리**(짧은 뜻·소리 역할 또는 의미 변화) 두 항목만 표시합니다. 형성 원리를 확인하지 못한 항목은 미확정으로 표시합니다. 확인한 짧은 풀이를 보완하려면 `data/kanji-formation-overrides.json`을 수정하고 `node scripts/build_kanji.cjs`로 다시 생성하세요.

중복 단어도 모든 책·모든 DAY에 그대로 유지합니다. 같은 DAY 안의 반복 항목도 각각 출제합니다. 같은 표기가 있으면 겹치는 책·DAY·번호를 표시하고, 읽기·뜻이 다른 경우 별도로 안내합니다. 기존에 제외했던 30항목도 복원했습니다. [중복 안내 내역](data/duplicate-report.json)은 `node scripts/audit_vocabulary.cjs`로 재생성합니다. [사진 검수 보고서](data/photo-review-report.json)는 119장과 56개 DAY의 표제어·순서·수량 대조 결과이며 `node scripts/audit_photo_coverage.cjs`로 데이터 일치 여부를 재검증합니다.

원본은 `data/source-words.js`에 보관합니다. `node scripts/build_vocabulary.cjs`로 모든 원문 항목을 보존한 배포용 `data/words.js`를 생성하며, 브라우저에서는 원본 파일을 불러오지 않습니다. 단어를 추가하거나 수정한 뒤에는 배포용 데이터를 다시 생성하세요.

메인북 사진 59장을 125쪽까지 가로순(왼쪽 → 오른쪽 → 다음 줄)으로 정리했습니다. DAY 01–15는 기출단어, DAY 16–26은 핵심단어 리스트 두 페이지씩입니다. 2,409항목 중 유의어는 155쌍이며 양쪽 표기·읽기·뜻을 보존합니다. 필기는 제외했습니다. 기존 1·2일차 167개의 ID는 그대로 두고 표시 순서만 수정했습니다.

- [전체 메인북 CSV](data/mainbook-vocabulary.csv): 중복 제거 전 전체 항목과 사진 출처. Excel에서 바로 열 수 있는 UTF-8 BOM 형식입니다.
- [사진별 전사본](data/mainbook-photos.json), [가로순 표제어](data/mainbook-photo-order.txt), [사진별 수량](data/mainbook-photo-report.json).
- 읽기·뜻은 기존 책 데이터와 대조했으며, 새 표현·문맥별 보완은 `data/mainbook-photo-glossary.txt`에 기록했습니다.
- 전사본 수정 후 `node scripts/import_mainbook_photos.cjs`, `node scripts/audit_vocabulary.cjs`로 다시 반영합니다. `transcribe_mainbook_photos.cjs`는 기존 데이터로 전사본을 재구성하는 보조 도구이므로 전사본을 직접 교정한 뒤에는 재실행하지 마세요.
- 한자 기본 자료를 재생성했다면 `node scripts/build_mainbook_kanji.cjs`로 사진 추가 단어의 자형 설명을 보완하세요.
- 유의어 문제는 모든 퀴즈 모드에서 짝을 떠올리는 카드로 표시합니다. Z로 뜻과 유의어를 공개하고 X로 읽기를 표시하며, C·Space로 학습 결과를 기록합니다.

사전 자료의 출처와 배포 조건은 [한자 자료 안내](data/kanji-sources/NOTICE.md)에 기록했습니다.
