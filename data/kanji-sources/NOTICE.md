# 전체 단어장 한자 자료

전체 2,543개 단어의 1,070자(한자 반복 부호 々 포함)를 수록합니다. 기존 수기 설명 129자를 유지하고 941자를 사전 자료에서 추가했습니다. `coverage.json`에 범위와 원본 SHA-256을 기록합니다.

- 한국어 훈음: [libhangul hanja.txt](https://github.com/libhangul/libhangul/blob/main/data/hanja/hanja.txt), Copyright (c) 2005,2006 Choe Hwanjin. 이 파일 자체의 BSD 3-Clause 조건은 `libhangul-BSD.txt`에 보존했습니다. 독음마다 나열된 여러 훈 가운데 앞의 두 가지까지 사용합니다.
- 글자 구성·형성자 분류: [Make Me a Hanzi dictionary.txt](https://github.com/skishore/makemeahanzi/blob/master/dictionary.txt), Unihan 및 CJKlib 기반. 데이터 및 이를 가공한 `kanji-all.js`는 LGPL-3.0-or-later 조건으로 배포합니다. 원문의 배포 조건과 라이선스는 `COPYING.txt`, `LGPL.txt`에 보존했습니다. 해당 자료의 원문 부분 집합은 `source-subset.json`, 변환 코드는 `scripts/build_kanji.cjs`입니다. 프로젝트의 다른 코드에 이 데이터의 라이선스를 일괄 적용하지 않습니다.
- 일본 신자체·구자체 대응: Taichi Kawabata 편 [CJKVI jp-old-style.txt](https://github.com/cjkvi/cjkvi-variants/blob/master/jp-old-style.txt). 사전에서 직접 찾을 수 없는 자형의 한국어 훈음·구성을 대조하는 데 사용했습니다. 전체 대응표를 재배포하지 않고 사용한 대응 관계만 기록합니다.
- 일본 국자 働: [한자페디아](https://www.kanjipedia.jp/kanji/0005278100). 込 등 국자에는 중국 한자에서 유래했다는 설명이나 임의의 한국 한자음을 붙이지 않습니다.

역사적 어원을 확인한 것처럼 꾸민 풀이를 피하기 위해, 소리·뜻 요소가 명시된 형성자 494자에는 그 관계를 설명하고, 자형 구성만 제공하는 395자에는 **구성 설명과 역사적 어원은 다름**을 명시합니다. 후자는 역사적 어원 검증이 끝난 항목으로 간주하지 않습니다. 나머지는 상형자 35자와 별도 정리한 자형·국자 17자입니다. 단어별 쓰임의 예시는 앱의 기존 일본어·읽기·한국어 뜻을 사용하며, 그 뜻이 개별 한자의 뜻을 단순 합산한 결과라고 단정하지 않습니다.

재생성: `tmp/kanji-sources`에 위 세 원본과 Make Me a Hanzi의 `COPYING`, `LGPL`을 각각 `hanja.txt`, `dictionary.txt`, `jp-old-style.txt`, `COPYING.txt`, `LGPL.txt`로 저장한 뒤 `node scripts/build_kanji.cjs`를 실행합니다. 공개한 부분 집합은 수정·재가공할 수 있으며 브라우저 실행 시 외부 사전에 접속하지 않습니다.

LGPL이 참조하는 GNU GPL v3 원문도 `GPL.txt`에 함께 보존합니다.
