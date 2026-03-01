import { program } from "commander";
import { activityCommand } from "./commands/activity.js";
import { authCommand } from "./commands/auth.js";
import { cacheCommand } from "./commands/cache.js";
import { discussionCommand } from "./commands/discussion.js";
import { issueCommand } from "./commands/issue.js";
import { prCommand } from "./commands/pr.js";
import { repoCommand } from "./commands/repo.js";
import { scoreCommand } from "./commands/score.js";

program
	.name("gitbaz")
	.description("GitHub Contributor Context — sharp as a falcon")
	.version("0.1.0");

program.addCommand(authCommand);
program.addCommand(scoreCommand);
program.addCommand(activityCommand);
program.addCommand(prCommand);
program.addCommand(issueCommand);
program.addCommand(discussionCommand);
program.addCommand(repoCommand);
program.addCommand(cacheCommand);

program.parse();
