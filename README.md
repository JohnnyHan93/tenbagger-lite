# Tenbagger Lite

Wildcard 5% 개인용 텐배거 디스커버리 터미널.

점수는 매수 신호가 아닙니다. Deep Dive 가치만 측정합니다.

## 배포 (Vercel Hobby)

1. 이 저장소를 [Vercel](https://vercel.com/new)에 Import
2. Framework Preset는 Vite / Other 그대로 두고 Build Command는 `npm run build`
3. (선택) Environment Variable `XAI_API_KEY` — 있으면 Grok 자동 리서치, 없으면 시세 + 휴리스틱만 동작
4. Deploy

워치리스트·점수는 **브라우저에만** 저장됩니다. 폰/PC가 다르면 설정에서 Backup/Restore 하세요.

## 로컬

```bash
npm install
npm run dev
```
