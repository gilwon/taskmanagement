-- 재고 알림 종류 'stock'을 notification_type에 더한다. 새 enum 값은 같은 트랜잭션에서 쓸 수 없어 파일을 따로 둔다.
alter type public.notification_type add value 'stock';
