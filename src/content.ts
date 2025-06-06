// Chatworkのメンション機能を追加するコンテンツスクリプト

interface ChatworkUser {
  id: string;
  name: string;
  avatar?: string;
}

class ChatworkMentionExtension {
  private users: ChatworkUser[] = [];
  private mentionContainer: HTMLElement | null = null;
  private currentInput: HTMLElement | null = null;
  private isShowing = false;
  private selectedIndex = 0;
  private filteredUsers: ChatworkUser[] = [];

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // ページが完全に読み込まれるのを待つ
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.initialize.bind(this));
    } else {
      this.initialize();
    }
  }

  private initialize(): void {
    console.log("Chatwork Mention Extension: Initializing...");
    this.extractUsersFromPage();
    this.observeChatInputArea();
    this.createMentionListElement();
    console.log("Chatwork Mention Extension: Initialized successfully.");
  }

  private async extractUsersFromPage(retryCount = 0): Promise<void> {
    // ユーザー情報を抽出するセレクタを改善
    const userElements = document.querySelectorAll(
      'li[role="listitem"] [data-cwui-lt-idx], [data-testid="contact-list-item"]'
    );
    const uniqueUsers = new Map<string, ChatworkUser>();

    userElements.forEach((el) => {
      const nameEl =
        el.querySelector('[data-testid="contact-name"], ._contactListName') ||
        el.querySelector("img[alt]") ||
        el; // 名前が見つからない場合はalt属性や要素自体から
      const avatarEl = el.querySelector(
        'img[data-testid="avatar-image"], img._avatar'
      );

      let userId = el.getAttribute("data-cwui-lt-idx"); // 新しいUIの可能性
      if (!userId) {
        // 古いUIや他の場所からの取得を試みる
        const idContainingElement = el.closest("[data-mid]") || el;
        userId =
          idContainingElement.getAttribute("data-mid") ||
          idContainingElement.getAttribute("data-aid") || // アカウントIDも考慮
          idContainingElement.getAttribute("data-cwui-contact-aid"); // 新しいUIのアカウントID
      }

      let userName = nameEl?.textContent?.trim() || "";
      if (!userName && avatarEl) {
        userName = avatarEl.getAttribute("alt") || ""; // アバターのalt属性から名前を取得
      }
      userName = userName.replace(/\[.*\]/g, "").trim(); // [組織名]などを除去

      if (userId && userName && !uniqueUsers.has(userId)) {
        uniqueUsers.set(userId, {
          id: userId,
          name: userName,
          avatar: avatarEl?.getAttribute("src") || undefined,
        });
      }
    });

    // メンバーリストからも抽出を試行 (ルームメンバーなど)
    document
      .querySelectorAll("#_memberListItems li, .roomMemberList__listItem")
      .forEach((item) => {
        const userId = item.getAttribute("data-aid"); // アカウントID
        const nameElement = item.querySelector(
          ".roomMemberTable__nameText, ._nameText"
        );
        const avatarElement = item.querySelector("img._avatar");
        const userName = nameElement?.textContent?.trim();

        if (userId && userName && !uniqueUsers.has(userId)) {
          uniqueUsers.set(userId, {
            id: userId,
            name: userName,
            avatar: avatarElement?.getAttribute("src") || undefined,
          });
        }
      });

    // サイドバーのルームリストからも抽出を試行（新UI対応）
    const sidebarRoomItems = document.querySelectorAll(
      '#RoomList ul > li[role="tab"][data-rid]'
    );
    sidebarRoomItems.forEach((item, idx) => {
      // 不要なデバッグ出力を削除
      const userId = item.getAttribute("data-rid");
      let nameElement = item.querySelector("div.sc-jOJSqX p");
      if (!nameElement) {
        nameElement = item.querySelector("p");
      }
      const avatarElement = item.querySelector("img");
      const userName = nameElement?.textContent?.trim() || "";
      if (userId && userName && !uniqueUsers.has(userId)) {
        uniqueUsers.set(userId, {
          id: userId,
          name: userName,
          avatar: avatarElement?.getAttribute("src") || undefined,
        });
      }
    });

    this.users = Array.from(uniqueUsers.values());
    if (this.users.length === 0) {
      if (retryCount < 5) {
        // 1秒後にリトライ（最大5回）
        setTimeout(() => this.extractUsersFromPage(retryCount + 1), 1000);
        if (retryCount === 0) {
          console.warn(
            "Chatwork Mention Extension: No users found on the page. Retrying..."
          );
        }
      } else {
        console.warn(
          "Chatwork Mention Extension: No users found on the page after multiple attempts. Mention feature might not work correctly."
        );
      }
    } else {
      console.log(
        `Chatwork Mention Extension: Found ${this.users.length} users.`,
        this.users
      );
    }
  }

  private observeChatInputArea(): void {
    // Chatworkのメインチャット入力エリアを特定し、その親要素を監視
    // これにより、入力フィールドが動的に再生成されても対応可能
    const chatToolArea =
      document.getElementById("_chatSendArea") || document.body;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.findAndAttachToInputFields(node as Element);
            }
          });
        }
      });
      // 既存の入力フィールドにもアタッチ
      this.findAndAttachToInputFields(document.body);
    });

    observer.observe(chatToolArea, {
      childList: true,
      subtree: true,
    });
    // 初回実行
    this.findAndAttachToInputFields(document.body);
  }

  private findAndAttachToInputFields(container: Element): void {
    const inputSelectors = [
      "textarea#_chatText", // メインチャット入力
      'textarea[data-testid="ftf-form-textarea"]', // 新UIのチャット入力
      "textarea._mainTextarea", // 古いUIのチャット入力
      'textarea[placeholder*="メッセージ"]', // プレースホルダーで検索
    ];

    inputSelectors.forEach((selector) => {
      container.querySelectorAll(selector).forEach((input) => {
        if (!input.hasAttribute("data-mention-extension-enabled")) {
          input.setAttribute("data-mention-extension-enabled", "true");
          this.addEventListenersToInput(input as HTMLTextAreaElement);
          console.log(
            "Chatwork Mention Extension: Attached to input field:",
            input
          );
        }
      });
    });
  }

  private addEventListenersToInput(input: HTMLTextAreaElement): void {
    input.addEventListener("input", this.onInput.bind(this));
    input.addEventListener("keydown", this.onKeyDown.bind(this));
    input.addEventListener("blur", this.onBlur.bind(this));
  }

  private onInput(event: Event): void {
    const inputElement = event.target as HTMLTextAreaElement;
    this.currentInput = inputElement;
    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([\p{L}\p{N}_-]*)$/u); // Unicode文字対応

    if (mentionMatch) {
      const query = mentionMatch[1];
      this.displayMentionList(inputElement, query);
    } else {
      this.hideMentionList();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isShowing || !this.mentionContainer) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.selectedIndex =
          (this.selectedIndex + 1) % this.filteredUsers.length;
        this.highlightSelectedItem();
        break;
      case "ArrowUp":
        event.preventDefault();
        this.selectedIndex =
          (this.selectedIndex - 1 + this.filteredUsers.length) %
          this.filteredUsers.length;
        this.highlightSelectedItem();
        break;
      case "Enter":
      case "Tab":
        event.preventDefault();
        this.insertMention();
        break;
      case "Escape":
        event.preventDefault();
        this.hideMentionList();
        break;
    }
  }

  private onBlur(): void {
    // 少し遅延させて非表示にする (クリックイベントを処理するため)
    setTimeout(() => {
      if (!this.mentionContainer?.contains(document.activeElement)) {
        this.hideMentionList();
      }
    }, 100);
  }

  private displayMentionList(
    inputElement: HTMLTextAreaElement,
    query: string
  ): void {
    this.filteredUsers = this.users
      .filter(
        (user) =>
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.id.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10); // 最大10件

    if (this.filteredUsers.length === 0) {
      this.hideMentionList();
      return;
    }

    this.selectedIndex = 0;
    this.isShowing = true;
    this.updateMentionListDOM(inputElement);
    this.mentionContainer!.style.display = "block";
  }

  private createMentionListElement(): void {
    if (this.mentionContainer) return;
    this.mentionContainer = document.createElement("div");
    this.mentionContainer.className = "chatwork-mention-list";
    // スタイルはCSSファイルで管理するため、ここではクラス名のみ設定
    document.body.appendChild(this.mentionContainer);
  }

  private updateMentionListDOM(inputElement: HTMLTextAreaElement): void {
    if (!this.mentionContainer) return;

    const inputRect = inputElement.getBoundingClientRect();
    this.mentionContainer.style.top = `${
      window.scrollY + inputRect.bottom + 2
    }px`;
    this.mentionContainer.style.left = `${window.scrollX + inputRect.left}px`;
    this.mentionContainer.style.minWidth = `${inputRect.width}px`;

    this.mentionContainer.innerHTML = ""; // リストをクリア

    this.filteredUsers.forEach((user, index) => {
      const item = document.createElement("div");
      item.className = "mention-item";
      if (index === this.selectedIndex) {
        item.classList.add("selected");
      }

      const avatarImg = user.avatar
        ? `<img src="${user.avatar}" alt="${user.name}" class="mention-avatar">`
        : `<div class="mention-avatar-placeholder"></div>`;

      // 不要なデバッグ出力を削除

      // 名前のみを表示
      item.innerHTML = `
        ${avatarImg}
        <span class="mention-name">${user.name}</span>
      `;

      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.selectedIndex = index;
        this.insertMention();
      });
      this.mentionContainer!.appendChild(item);
    });
    this.highlightSelectedItem();
  }

  private highlightSelectedItem(): void {
    if (!this.mentionContainer) return;
    this.mentionContainer
      .querySelectorAll(".mention-item")
      .forEach((item, i) => {
        if (i === this.selectedIndex) {
          item.classList.add("selected");
          item.scrollIntoView({ block: "nearest" });
        } else {
          item.classList.remove("selected");
        }
      });
  }

  private insertMention(): void {
    if (
      !this.currentInput ||
      this.selectedIndex < 0 ||
      this.selectedIndex >= this.filteredUsers.length
    ) {
      this.hideMentionList();
      return;
    }

    const user = this.filteredUsers[this.selectedIndex];
    const input = this.currentInput as HTMLTextAreaElement;
    const currentText = input.value;
    const cursorPos = input.selectionStart;

    const textBeforeCursor = currentText.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@([\p{L}\p{N}_-]*)$/u);

    if (match) {
      const mentionTrigger = match[0];
      const startIndex = cursorPos - mentionTrigger.length;

      // Chatworkの標準的なメンション形式 [To:ユーザーID] ユーザー名 を使用
      const mentionText = `[To:${user.id}] ${user.name} `;

      input.value =
        currentText.substring(0, startIndex) +
        mentionText +
        currentText.substring(cursorPos);

      const newCursorPos = startIndex + mentionText.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
      input.focus();

      // 手動でinputイベントを発火させて、入力内容の変更をChatworkに通知
      const event = new Event("input", { bubbles: true, cancelable: true });
      input.dispatchEvent(event);
    }
    this.hideMentionList();
  }

  private hideMentionList(): void {
    if (this.mentionContainer) {
      this.mentionContainer.style.display = "none";
    }
    this.isShowing = false;
    this.currentInput = null;
  }
}

// 拡張機能を初期化
new ChatworkMentionExtension();
