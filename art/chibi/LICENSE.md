# chibi 그림체의 원본 그림 — 출처와 라이선스

`web/src/guestbook/styles/chibi` ("손그림 치비", 테스트 전용)는 **MaelleMarylloup** 의 CHIBI 컬렉션(444x700 손그림 레이어)을
잘라 조합한다. 그림은 이 저장소에 들어 있지 않다.

## 출처

| 팩 | 주소 | 쓰는 것 |
| --- | --- | --- |
| Build a character [REWORKED] | https://maellemarylloup.itch.io/chibi-character-basics-reworked | 몸(피부 6색 · 부위 지도 `body_layered.png`), 얼굴, 머리카락(흑백 선화), 윗옷·바지·치마·원피스·신발 |
| Masc misc (Character) | https://maellemarylloup.itch.io/masc-misc-character | 남자 머리 모양, 윗옷·바지 (턱시도 포함) |
| Fairy Royal Couple (Chibi assets) | https://maellemarylloup.itch.io/fairy-royal-couple-chibi-assets | 화관 · 나뭇가지 왕관 · 귀걸이 · 볼터치 · 날개 |

저작자: MaelleMarylloup (https://maellemarylloup.itch.io)

## 라이선스 (각 팩 페이지의 문구)

> License : FREE to use in any personal or commercial project (you just can't resell the assets on their own)

> ~for personal and commercial use (you just can't resell the asets alone)

## 주의: 재배포

개인·상업 프로젝트에서 쓰는 것은 허용되지만, **원본 파일을 공개 저장소로 다시 배포해도 된다는 말은 없다.**
그래서 이 그림체는 `msref` 와 같은 "테스트 전용" 으로 다룬다.

- `art/chibi/raw/` (내려받은 원본 가운데 쓰는 109개) 와 `web/src/guestbook/styles/chibi/assets/` (구운 아틀라스),
  `art/chibi/preview.png` (조합 확인용 시트)는 각 폴더의 `.gitignore` 로 저장소에서 빠져 있다.
- 앱에서는 `VITE_REF_STYLES=1` 로 빌드했고 아틀라스가 그 빌드에 들어 있을 때만 고를 수 있다.
- 공개 배포에 넣으려면 먼저 저작자에게 재배포(아틀라스 형태 포함) 허락을 받고, 저작자 표시를 `public/CREDITS.txt` 에 넣는다.

## 다시 만들기

```sh
# 1) 위 세 팩을 itch.io 에서 내려받아 한 폴더에 푼다:
#      <src>/raw/dl_14738387_x/…            (Build a character [REWORKED])
#      <src>/raw-masc/x2/…                  (Masc misc)
#      <src>/raw-royal/dl_14252253_x/…      (Fairy Royal Couple)
#    폴더 이름이 다르면 build.py 의 SRC_DIRS 를 고친다.
python -I art/chibi/build.py collect <src>   # 쓰는 파일만 art/chibi/raw/ 로 복사
python -I art/chibi/build.py build           # 아틀라스 + catalog.ts
python -I art/chibi/build.py preview         # art/chibi/preview.png
```

## 직접 그린 것

동그란 안경 · 리본 · 면사포는 팩에 없어 `build.py` 가 도형으로 그린다 (원본 그림을 쓰지 않는다).
걷는 동작(팔다리를 관절에서 돌리고 줄인 변형)과 뒷모습(뒤통수)은 원본 한 자세에서 `build.py` 가 만들어 낸 것이다.
