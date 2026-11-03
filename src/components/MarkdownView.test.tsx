import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownView } from "./MarkdownView";

describe("MarkdownView", () => {
  it("renders headings, lists and inline styles", () => {
    const source = [
      "# Mars 日报",
      "## 今日概览",
      "- 记录条数：3",
      "- **专注时长**：120 分钟",
      "## 工作记录",
      "### 项目 A",
      "- 完成登录模块（40 分钟）",
    ].join("\n");

    const { container } = render(<MarkdownView content={source} />);

    expect(container.querySelector("h1")?.textContent).toBe("Mars 日报");
    expect(container.querySelector("h2")?.textContent).toContain("今日概览");
    expect(container.querySelector("h3")?.textContent).toBe("项目 A");
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.querySelector("strong")?.textContent).toBe("专注时长");
  });

  it("keeps unsafe links out of href", () => {
    const { container } = render(<MarkdownView content="[危险](javascript:alert(1))" />);

    expect(container.querySelector("a")).toBeNull();
  });
});
