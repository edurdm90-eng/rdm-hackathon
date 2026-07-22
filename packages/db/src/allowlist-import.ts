import { z } from "zod";

const validRoles = ["member", "host"] as const;
type AllowlistRole = (typeof validRoles)[number];

export type ParsedAllowlistRow = {
  email: string;
  line: number;
  role: AllowlistRole;
};

export type InvalidAllowlistRow = {
  line: number;
  reason: string;
  value: string;
};

export type AllowlistImportParseResult = {
  duplicateRows: number;
  invalidRows: InvalidAllowlistRow[];
  rows: ParsedAllowlistRow[];
};

const emailSchema = z.string().trim().email();

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseRole(value: string | undefined):
  | {
      role: AllowlistRole;
      success: true;
    }
  | {
      reason: string;
      success: false;
    } {
  const role = value?.trim().toLowerCase();

  if (!role) {
    return {
      role: "member",
      success: true,
    };
  }

  if (role === "member" || role === "host") {
    return {
      role,
      success: true,
    };
  }

  return {
    reason: `Invalid role "${value}"`,
    success: false,
  };
}

function parseDelimitedLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

function headerIndexes(fields: string[]) {
  const normalizedFields = fields.map((field) => field.trim().toLowerCase());
  const emailIndex = normalizedFields.indexOf("email");

  if (emailIndex < 0) {
    return null;
  }

  return {
    emailIndex,
    roleIndex: normalizedFields.indexOf("role"),
  };
}

export function parseAllowlistImport(
  contents: string,
): AllowlistImportParseResult {
  const rows: ParsedAllowlistRow[] = [];
  const invalidRows: InvalidAllowlistRow[] = [];
  const seenEmails = new Set<string>();
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/);
  let duplicateRows = 0;
  let header: {
    emailIndex: number;
    roleIndex: number;
  } | null = null;
  let sawFirstDataLine = false;

  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1;
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return;
    }

    const fields = parseDelimitedLine(trimmedLine);

    if (!sawFirstDataLine) {
      sawFirstDataLine = true;
      header = headerIndexes(fields);
      if (header) {
        return;
      }
    }

    const emailValue = header ? fields[header.emailIndex] : fields[0];
    const parsedEmail = emailSchema.safeParse(emailValue);

    if (!parsedEmail.success) {
      invalidRows.push({
        line: lineNumber,
        reason: "Invalid email",
        value: emailValue ?? trimmedLine,
      });
      return;
    }

    const normalizedEmail = normalizeEmail(parsedEmail.data);
    const parsedRole = parseRole(header ? fields[header.roleIndex] : fields[1]);

    if (!parsedRole.success) {
      invalidRows.push({
        line: lineNumber,
        reason: parsedRole.reason,
        value: fields.join(","),
      });
      return;
    }

    if (seenEmails.has(normalizedEmail)) {
      duplicateRows += 1;
      return;
    }

    seenEmails.add(normalizedEmail);
    rows.push({
      email: normalizedEmail,
      line: lineNumber,
      role: parsedRole.role,
    });
  });

  return {
    duplicateRows,
    invalidRows,
    rows,
  };
}
