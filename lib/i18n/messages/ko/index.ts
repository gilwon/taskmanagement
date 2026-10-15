// 한국어 사전. 기준 사전이라 다른 언어는 이 키를 모두 가져야 한다(types.ts Messages)
import shell from "./shell";
import auth from "./auth";
import home from "./home";
import tasks from "./tasks";
import schedule from "./schedule";
import projects from "./projects";
import org from "./org";
import comments from "./comments";
import files from "./files";
import activity from "./activity";
import notifications from "./notifications";
import search from "./search";
import command from "./command";
import shortcuts from "./shortcuts";
import help from "./help";
import common from "./common";
import errors from "./errors";

export default { shell, auth, home, tasks, schedule, projects, org, comments, files, activity, notifications, search, command, shortcuts, help, common, errors } as const;
