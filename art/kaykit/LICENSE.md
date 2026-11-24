# kaykit 그림체 — 출처와 라이선스

## 원본

| | |
| --- | --- |
| 이름 | KayKit : Adventurers Character Pack (2.0), FREE 판 |
| 만든 이 | Kay Lousberg — <https://www.kaylousberg.com> |
| 받은 곳 | <https://kaylousberg.itch.io/kaykit-adventurers> → "Free 2.0" (`KayKit_Adventurers_2.0_FREE.zip`, 13,024,345 bytes, 2025-10-27 게시) |
| sha256 | `abe48f4763fba0896bab486ee9e6d08ca6b5b3884b9601f235c8847ae94dc479` |
| 받은 날 | 2026-11-24 |
| 라이선스 | Creative Commons Zero (CC0 1.0 Universal) — <http://creativecommons.org/publicdomain/zero/1.0/> |
| 같은 팩의 1.0 | <https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0> (CC0, 참고만 하고 쓰지 않았다) |

팩 안의 `License.txt` 는 `raw/License.txt` 에 그대로 두었다. 요지:

> License: (Creative Commons Zero, CC0) — This content is free to use in personal, educational and commercial projects.
> If you wish to credit me you can do so by crediting "Kay Lousberg, www.kaylousberg.com" (this is not mandatory)

itch.io 페이지의 안내: "Free for personal and commercial use, no attribution required. (CC0 Licensed) …
These assets are CC0 so you can use them freely. But please don't resell unmodified copies or claim them as your own."

FREE 판에 들어 있는 캐릭터는 Barbarian · Knight · Mage · Ranger · Rogue · Rogue_Hooded 여섯이다.
Druid · Engineer · Barbarian_Large 와 대체 텍스처는 유료(EXTRA) 판에만 있어 쓰지 않았다.

## 쓴 파일 (`raw/`)

- `characters/` Barbarian.glb, Knight.glb, Mage.glb, Ranger.glb, Rogue.glb, Rogue_Hooded.glb
- `animations/` Rig_Medium_General.glb (`Idle_A`), Rig_Medium_MovementBasic.glb (`Walking_A`)
- `assets/` mug_full, spellbook_closed, staff, wand (.gltf + .bin), barbarian_texture.png, mage_texture.png

## 바꾼 것

- 3D 모델을 조각(몸·머리·모자·손에 든 물건)별로 4방향 x 3프레임의 2D 그림으로 구웠다 (`build.mjs`).
- 팔레트 텍스처의 피부·머리카락·옷감 블록을 중립 회색으로 바꿔 구운 뒤 앱에서 고른 색을 곱한다. 신랑·신부 옷은 고정 색으로 다시 칠했다.
- 면사포·부케·화관·나비넥타이·부토니에르는 원본 팩의 것이 아니라 이 저장소에서 기본 도형으로 만든 것이다 (`config.mjs` 의 `buildProps`).
- 무기·방패·화살통은 쓰지 않았다.

## 표시 문구

CC0 라 표시 의무는 없지만 앱의 크레딧에 다음을 싣기를 권한다:

> 3D 모험가 캐릭터: "KayKit : Adventurers Character Pack" by Kay Lousberg (www.kaylousberg.com), CC0 1.0

## 그 밖의 도구 (빌드 때만 쓰고 결과물에 들어가지 않는다)

three.js (MIT), puppeteer-core (Apache-2.0), pngjs (MIT), libwebp `cwebp`/`dwebp` (BSD-3-Clause), ffmpeg.

## CC0 1.0 Universal 전문

```text
Creative Commons Legal Code

CC0 1.0 Universal

    CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE
    LEGAL SERVICES. DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN
    ATTORNEY-CLIENT RELATIONSHIP. CREATIVE COMMONS PROVIDES THIS
    INFORMATION ON AN "AS-IS" BASIS. CREATIVE COMMONS MAKES NO WARRANTIES
    REGARDING THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS
    PROVIDED HEREUNDER, AND DISCLAIMS LIABILITY FOR DAMAGES RESULTING FROM
    THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED
    HEREUNDER.

Statement of Purpose

The laws of most jurisdictions throughout the world automatically confer
exclusive Copyright and Related Rights (defined below) upon the creator
and subsequent owner(s) (each and all, an "owner") of an original work of
authorship and/or a database (each, a "Work").

Certain owners wish to permanently relinquish those rights to a Work for
the purpose of contributing to a commons of creative, cultural and
scientific works ("Commons") that the public can reliably and without fear
of later claims of infringement build upon, modify, incorporate in other
works, reuse and redistribute as freely as possible in any form whatsoever
and for any purposes, including without limitation commercial purposes.
These owners may contribute to the Commons to promote the ideal of a free
culture and the further production of creative, cultural and scientific
works, or to gain reputation or greater distribution for their Work in
part through the use and efforts of others.

For these and/or other purposes and motivations, and without any
expectation of additional consideration or compensation, the person
associating CC0 with a Work (the "Affirmer"), to the extent that he or she
is an owner of Copyright and Related Rights in the Work, voluntarily
elects to apply CC0 to the Work and publicly distribute the Work under its
terms, with knowledge of his or her Copyright and Related Rights in the
Work and the meaning and intended legal effect of CC0 on those rights.

1. Copyright and Related Rights. A Work made available under CC0 may be
protected by copyright and related or neighboring rights ("Copyright and
Related Rights"). Copyright and Related Rights include, but are not
limited to, the following:

  i. the right to reproduce, adapt, distribute, perform, display,
     communicate, and translate a Work;
 ii. moral rights retained by the original author(s) and/or performer(s);
iii. publicity and privacy rights pertaining to a person's image or
     likeness depicted in a Work;
 iv. rights protecting against unfair competition in regards to a Work,
     subject to the limitations in paragraph 4(a), below;
  v. rights protecting the extraction, dissemination, use and reuse of data
     in a Work;
 vi. database rights (such as those arising under Directive 96/9/EC of the
     European Parliament and of the Council of 11 March 1996 on the legal
     protection of databases, and under any national implementation
     thereof, including any amended or successor version of such
     directive); and
vii. other similar, equivalent or corresponding rights throughout the
     world based on applicable law or treaty, and any national
     implementations thereof.

2. Waiver. To the greatest extent permitted by, but not in contravention
of, applicable law, Affirmer hereby overtly, fully, permanently,
irrevocably and unconditionally waives, abandons, and surrenders all of
Affirmer's Copyright and Related Rights and associated claims and causes
of action, whether now known or unknown (including existing as well as
future claims and causes of action), in the Work (i) in all territories
worldwide, (ii) for the maximum duration provided by applicable law or
treaty (including future time extensions), (iii) in any current or future
medium and for any number of copies, and (iv) for any purpose whatsoever,
including without limitation commercial, advertising or promotional
purposes (the "Waiver"). Affirmer makes the Waiver for the benefit of each
member of the public at large and to the detriment of Affirmer's heirs and
successors, fully intending that such Waiver shall not be subject to
revocation, rescission, cancellation, termination, or any other legal or
equitable action to disrupt the quiet enjoyment of the Work by the public
as contemplated by Affirmer's express Statement of Purpose.

3. Public License Fallback. Should any part of the Waiver for any reason
be judged legally invalid or ineffective under applicable law, then the
Waiver shall be preserved to the maximum extent permitted taking into
account Affirmer's express Statement of Purpose. In addition, to the
extent the Waiver is so judged Affirmer hereby grants to each affected
person a royalty-free, non transferable, non sublicensable, non exclusive,
irrevocable and unconditional license to exercise Affirmer's Copyright and
Related Rights in the Work (i) in all territories worldwide, (ii) for the
maximum duration provided by applicable law or treaty (including future
time extensions), (iii) in any current or future medium and for any number
of copies, and (iv) for any purpose whatsoever, including without
limitation commercial, advertising or promotional purposes (the
"License"). The License shall be deemed effective as of the date CC0 was
applied by Affirmer to the Work. Should any part of the License for any
reason be judged legally invalid or ineffective under applicable law, such
partial invalidity or ineffectiveness shall not invalidate the remainder
of the License, and in such case Affirmer hereby affirms that he or she
will not (i) exercise any of his or her remaining Copyright and Related
Rights in the Work or (ii) assert any associated claims and causes of
action with respect to the Work, in either case contrary to Affirmer's
express Statement of Purpose.

4. Limitations and Disclaimers.

 a. No trademark or patent rights held by Affirmer are waived, abandoned,
    surrendered, licensed or otherwise affected by this document.
 b. Affirmer offers the Work as-is and makes no representations or
    warranties of any kind concerning the Work, express, implied,
    statutory or otherwise, including without limitation warranties of
    title, merchantability, fitness for a particular purpose, non
    infringement, or the absence of latent or other defects, accuracy, or
    the present or absence of errors, whether or not discoverable, all to
    the greatest extent permissible under applicable law.
 c. Affirmer disclaims responsibility for clearing rights of other persons
    that may apply to the Work or any use thereof, including without
    limitation any person's Copyright and Related Rights in the Work.
    Further, Affirmer disclaims responsibility for obtaining any necessary
    consents, permissions or other rights required for any use of the
    Work.
 d. Affirmer understands and acknowledges that Creative Commons is not a
    party to this document and has no duty or obligation with respect to
    this CC0 or use of the Work.

```
