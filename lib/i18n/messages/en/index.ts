// 영어 사전. 키는 한국어 사전과 같아야 한다
import shell from "./shell";
import auth from "./auth";
import home from "./home";
import tasks from "./tasks";
import schedule from "./schedule";
import projects from "./projects";
import org from "./org";
import comments from "./comments";
import files from "./files";
import inventory from "./inventory";
import activity from "./activity";
import notifications from "./notifications";
import search from "./search";
import command from "./command";
import shortcuts from "./shortcuts";
import help from "./help";
import common from "./common";
import errors from "./errors";
import type { Messages } from "../types";

export default { shell, auth, home, tasks, schedule, projects, org, comments, files, inventory, activity, notifications, search, command, shortcuts, help, common, errors } satisfies Messages;
