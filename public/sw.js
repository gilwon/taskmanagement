// 웹 푸시 서비스 워커. push 이벤트로 알림을 띄우고, 클릭하면 해당 화면을 연다
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // 형식이 틀린 페이로드는 빈 알림 대신 무시한다
    return;
  }
  const title = typeof data.title === "string" && data.title ? data.title : "알림";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      data: { url: typeof data.url === "string" ? data.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // 같은 출처의 상대 경로만 연다
  const raw = event.notification.data && event.notification.data.url;
  const url = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
