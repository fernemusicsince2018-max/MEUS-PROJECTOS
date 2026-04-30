create table if not exists catalog_stores (
  id varchar(64) primary key,
  name varchar(160) not null default '',
  description text null,
  whatsapp varchar(32) null,
  logo text null,
  color varchar(16) not null default '#16a34a',
  pickup_note varchar(255) null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
);

create table if not exists catalog_products (
  id varchar(64) primary key,
  catalog_id varchar(64) not null,
  name varchar(180) not null,
  description text null,
  price decimal(10,2) not null default 0,
  compare_at decimal(10,2) not null default 0,
  image text null,
  images json null,
  category varchar(120) null,
  stock int null,
  featured tinyint(1) not null default 0,
  on_promotion tinyint(1) not null default 0,
  available tinyint(1) not null default 1,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_catalog_products_store
    foreign key (catalog_id) references catalog_stores(id)
    on delete cascade,
  index idx_catalog_products_store (catalog_id),
  index idx_catalog_products_category (catalog_id, category),
  index idx_catalog_products_featured (catalog_id, featured)
);
