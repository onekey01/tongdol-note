/**
 * `import ttf from "...ttf" with { type: "file" }` 를 타입 검사기에게 알려 줍니다.
 *
 * Bun 이 이렇게 가져온 파일은 **프로그램 안에 같이 들어갑니다.**
 * `bun build --compile` 로 exe 를 만들면 글꼴이 exe 안에 박히므로
 * 기관 PC 에 글꼴을 따로 깔 필요가 없습니다.
 * 값은 그 파일을 가리키는 경로 문자열이고, `Bun.file(경로)` 로 읽습니다.
 */
declare module "*.ttf" {
  const 경로: string;
  export default 경로;
}
