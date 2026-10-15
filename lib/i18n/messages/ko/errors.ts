// 서버 액션·RPC 오류 안내 한국어 문구
export default {
  generic: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  // 입력 검증 문구(lib/auth/errors.ts MSG). 클라이언트 폼과 Server Action이 같은 문구를 쓴다
  msg: {
    emailRequired: "이메일을 입력해 주세요.",
    emailInvalid: "이메일 형식이 올바르지 않습니다.",
    passwordRequired: "비밀번호를 입력해 주세요.",
    nameRequired: "이름을 입력해 주세요.",
    nameTooLong: "이름은 80자 이하로 입력해 주세요.",
    passwordMismatch: "비밀번호가 서로 다릅니다.",
    recoveryExpired: "재설정 링크가 만료되었습니다. 비밀번호 찾기를 다시 요청해 주세요.",
    sessionExpired: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
    usageRequired: "용도를 선택해 주세요.",
    workspaceNameRequired: "워크스페이스 이름을 입력해 주세요.",
    workspaceNameTooLong: "워크스페이스 이름은 80자 이하로 입력해 주세요.",
    slugInvalid: "URL은 영문 소문자·숫자·하이픈으로 2–39자, 첫 글자는 영문이나 숫자여야 합니다.",
    teamSizeRequired: "규모를 선택해 주세요.",
    projectNameRequired: "프로젝트 이름을 입력해 주세요.",
    templateRequired: "템플릿을 선택해 주세요.",
    tooManyInvites: "초대는 3명까지 할 수 있습니다.",
    emailTaken: "이미 가입된 이메일입니다. 로그인해 주세요.",
    demoDisabled: "데모가 꺼져 있습니다.",
    demoNotReady: "데모가 아직 준비되지 않았습니다.",
    demoRestricted: "데모 계정에서는 쓸 수 없는 기능입니다.",
    demoFull: "데모 사용자가 많습니다. 잠시 후 다시 시도해 주세요.",
  },
  passwordTooShort: "비밀번호는 {min}자 이상이어야 합니다.",
  // Supabase Auth 오류 코드별 안내
  auth: {
    invalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
    emailNotConfirmed: "이메일 확인이 필요합니다. 메일함의 확인 링크를 눌러 주세요.",
    emailAddressInvalid: "사용할 수 없는 이메일 주소입니다.",
    weakPassword: "비밀번호가 너무 약합니다. 영문과 숫자를 섞어 {min}자 이상으로 정해 주세요.",
    samePassword: "이전과 다른 비밀번호를 입력해 주세요.",
    emailRateLimit: "메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.",
    requestRateLimit: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    linkExpired: "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.",
    badCodeVerifier: "링크를 요청한 브라우저에서 다시 열어 주세요.",
    signupDisabled: "지금은 가입을 받지 않습니다.",
    emailProviderDisabled: "지금은 이메일 가입을 받지 않습니다.",
  },
  // RPC 고정 오류 코드(P0001)별 안내
  rpc: {
    forbidden: "이 작업을 할 권한이 없습니다.",
    invalidInput: "입력값을 다시 확인해 주세요.",
    slugTaken: "이미 쓰이고 있는 URL입니다. 다른 URL을 입력해 주세요.",
  },
} as const;
