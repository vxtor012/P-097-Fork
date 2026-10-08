-- Fresh demo catalog snapshot only. Never run on an existing database.
-- Business fixtures: python scripts/db/mock_data.py plan/apply/check

-- Dealers
INSERT INTO dealers (id, name, province, address, phone) VALUES
  ('d1000000-0000-0000-0000-000000000001','VinFast Mỹ Đình',   'Hà Nội',          'Vincom Mega Mall Mỹ Đình','024 3974 3888'),
  ('d1000000-0000-0000-0000-000000000002','VinFast Long Biên',  'Hà Nội',          'Vincom Long Biên',        '024 3974 3889'),
  ('d1000000-0000-0000-0000-000000000003','VinFast Quận 7',     'TP. Hồ Chí Minh', 'Vincom Mega Mall Q7',     '028 3974 3888'),
  ('d1000000-0000-0000-0000-000000000004','VinFast Đà Nẵng',    'Đà Nẵng',         'Vincom Đà Nẵng',          '0236 397 3888')
ON CONFLICT DO NOTHING;

-- Vehicle prices
INSERT INTO vehicle_prices (id, model, version, color, color_hex, price, price_version, effective_from, image_url) VALUES
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Trắng Tinh Khôi', '#FFFFFF', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw567e1bfc/images/VF3/TI1BV/CE18.png'),
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Đen Huyền Bí', '#1A1A1A', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw0636251d/images/VF3/TI1CV/CE1V.png'),
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Đỏ Năng Lượng', '#A31F2A', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw759f9cc4/images/VF3/TI1BV/CE2Q.png'),
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Xanh Bạc Hà', '#7CB3A3', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw773d98a5/images/VF3/TI1BV/CE1W.png'),
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Xám Tinh Tế', '#5F6363', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwf15aee3c/images/VF3/TI1BV/CE1V.png'),
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Vàng nóc Trắng', '#F5B800', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa9c70ae6/images/VF3/TI1BV/181U.png'),
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Xanh Cổng Trời nóc Trắng', '#4A90D9', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw23ab8ed8/images/VF3/TI1BV/181Y.png'),
  (gen_random_uuid(), 'VF3', 'Tiêu chuẩn', 'Hồng nóc Trắng', '#E8A2A8', 235000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw6b48f3ce/images/VF3/TI1BV/1821.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Trắng Tinh Khôi', '#FFFFFF', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw567e1bfc/images/VF3/TI1BV/CE18.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Đen Huyền Bí', '#1A1A1A', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw0636251d/images/VF3/TI1CV/CE1V.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Đỏ Năng Lượng', '#A31F2A', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw759f9cc4/images/VF3/TI1BV/CE2Q.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Xanh Bạc Hà', '#7CB3A3', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw773d98a5/images/VF3/TI1BV/CE1W.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Xám Tinh Tế', '#5F6363', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwf15aee3c/images/VF3/TI1BV/CE1V.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Vàng nóc Trắng', '#F5B800', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa9c70ae6/images/VF3/TI1BV/181U.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Xanh Cổng Trời nóc Trắng', '#4A90D9', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw23ab8ed8/images/VF3/TI1BV/181Y.png'),
  (gen_random_uuid(), 'VF3', 'Plus', 'Hồng nóc Trắng', '#E8A2A8', 285000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw6b48f3ce/images/VF3/TI1BV/1821.png'),
  (gen_random_uuid(), 'VF5', 'Tiêu chuẩn', 'Trắng Tinh Khôi', '#FFFFFF', 414000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa56f6ef3/images/VF5/GA12V/CE18.png'),
  (gen_random_uuid(), 'VF5', 'Tiêu chuẩn', 'Đen Huyền Bí', '#1A1A1A', 414000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe77f7665/images/VF5/GA12V/111U.png'),
  (gen_random_uuid(), 'VF5', 'Tiêu chuẩn', 'Đỏ Năng Lượng', '#A31F2A', 414000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe1fd1d5e/images/VF5/GA12V/CE2Q.png'),
  (gen_random_uuid(), 'VF5', 'Tiêu chuẩn', 'Xanh Bạc Hà', '#7CB3A3', 414000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwc759397a/images/VF5/GA12V/CE1W.png'),
  (gen_random_uuid(), 'VF5', 'Tiêu chuẩn', 'Xám Tinh Tế', '#5F6363', 414000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw99cec5c0/images/VF5/GA12V/CE1V.png'),
  (gen_random_uuid(), 'VF5', 'Tiêu chuẩn', 'Xanh Cổng Trời nóc Trắng', '#4A90D9', 414000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw699981ee/images/VF5/GA12V/181Y.png'),
  (gen_random_uuid(), 'VF5', 'Tiêu chuẩn', 'Vàng nóc Đen', '#F5B800', 414000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe77f7665/images/VF5/GA12V/111U.png'),
  (gen_random_uuid(), 'VF5', 'Plus', 'Trắng Tinh Khôi', '#FFFFFF', 458000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa56f6ef3/images/VF5/GA12V/CE18.png'),
  (gen_random_uuid(), 'VF5', 'Plus', 'Đen Huyền Bí', '#1A1A1A', 458000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe77f7665/images/VF5/GA12V/111U.png'),
  (gen_random_uuid(), 'VF5', 'Plus', 'Đỏ Năng Lượng', '#A31F2A', 458000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe1fd1d5e/images/VF5/GA12V/CE2Q.png'),
  (gen_random_uuid(), 'VF5', 'Plus', 'Xanh Bạc Hà', '#7CB3A3', 458000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwc759397a/images/VF5/GA12V/CE1W.png'),
  (gen_random_uuid(), 'VF5', 'Plus', 'Xám Tinh Tế', '#5F6363', 458000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw99cec5c0/images/VF5/GA12V/CE1V.png'),
  (gen_random_uuid(), 'VF5', 'Plus', 'Xanh Cổng Trời nóc Trắng', '#4A90D9', 458000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw699981ee/images/VF5/GA12V/181Y.png'),
  (gen_random_uuid(), 'VF5', 'Plus', 'Vàng nóc Đen', '#F5B800', 458000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe77f7665/images/VF5/GA12V/111U.png'),
  (gen_random_uuid(), 'VF6', 'Tiêu chuẩn', 'Trắng Tinh Khôi', '#FFFFFF', 599000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw649af361/images/VF6/JB12V/CE18.png'),
  (gen_random_uuid(), 'VF6', 'Tiêu chuẩn', 'Đen Huyền Bí', '#1A1A1A', 599000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa6b7f729/images/VF6/JB12V/CE11.png'),
  (gen_random_uuid(), 'VF6', 'Tiêu chuẩn', 'Xám Tinh Tế', '#5F6363', 599000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwc9c8bdb0/images/VF6/JB12V/CE1V.png'),
  (gen_random_uuid(), 'VF6', 'Tiêu chuẩn', 'Xanh Bạc Hà', '#7CB3A3', 599000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw93379ca4/images/VF6/JB12V/CE1W.png'),
  (gen_random_uuid(), 'VF6', 'Tiêu chuẩn', 'Đỏ Năng Lượng', '#A31F2A', 599000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw07fe1da3/images/VF6/JB12V/CE2Q.png'),
  (gen_random_uuid(), 'VF6', 'Plus', 'Trắng Tinh Khôi', '#FFFFFF', 639000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw649af361/images/VF6/JB12V/CE18.png'),
  (gen_random_uuid(), 'VF6', 'Plus', 'Đen Huyền Bí', '#1A1A1A', 639000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa6b7f729/images/VF6/JB12V/CE11.png'),
  (gen_random_uuid(), 'VF6', 'Plus', 'Xám Tinh Tế', '#5F6363', 639000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwc9c8bdb0/images/VF6/JB12V/CE1V.png'),
  (gen_random_uuid(), 'VF6', 'Plus', 'Xanh Bạc Hà', '#7CB3A3', 639000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw93379ca4/images/VF6/JB12V/CE1W.png'),
  (gen_random_uuid(), 'VF6', 'Plus', 'Đỏ Năng Lượng', '#A31F2A', 639000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw07fe1da3/images/VF6/JB12V/CE2Q.png'),
  (gen_random_uuid(), 'VF7', 'Tiêu chuẩn', 'Trắng Tinh Khôi', '#FFFFFF', 799000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw9769b6ea/images/VF7/GC12V/CE18.png'),
  (gen_random_uuid(), 'VF7', 'Tiêu chuẩn', 'Đen Huyền Bí', '#1A1A1A', 799000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw9dab72f2/images/VF7/GC12V/CE11.png'),
  (gen_random_uuid(), 'VF7', 'Tiêu chuẩn', 'Đỏ Năng Lượng', '#A31F2A', 799000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw2d2fec35/images/VF7/GC12V/CE2Q.png'),
  (gen_random_uuid(), 'VF7', 'Tiêu chuẩn', 'Xanh Bạc Hà', '#7CB3A3', 799000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw1256e862/images/VF7/GC12V/CE1W.png'),
  (gen_random_uuid(), 'VF7', 'Tiêu chuẩn', 'Xám Tinh Tế', '#5F6363', 799000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw43b08c43/images/VF7/GC12V/CE1V.png'),
  (gen_random_uuid(), 'VF7', 'Plus', 'Trắng Tinh Khôi', '#FFFFFF', 859000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw9769b6ea/images/VF7/GC12V/CE18.png'),
  (gen_random_uuid(), 'VF7', 'Plus', 'Đen Huyền Bí', '#1A1A1A', 859000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw9dab72f2/images/VF7/GC12V/CE11.png'),
  (gen_random_uuid(), 'VF7', 'Plus', 'Đỏ Năng Lượng', '#A31F2A', 859000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw2d2fec35/images/VF7/GC12V/CE2Q.png'),
  (gen_random_uuid(), 'VF7', 'Plus', 'Xanh Bạc Hà', '#7CB3A3', 859000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw1256e862/images/VF7/GC12V/CE1W.png'),
  (gen_random_uuid(), 'VF7', 'Plus', 'Xám Tinh Tế', '#5F6363', 859000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw43b08c43/images/VF7/GC12V/CE1V.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Trắng Tinh Khôi', '#FFFFFF', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw461c334b/images/VF8/ND32V/CE18.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Đen Huyền Bí', '#1A1A1A', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw76734143/images/VF8/ND32V/CE11.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Đỏ Thẫm Quý Phái', '#BA0C2F', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw0b574681/images/VF8/ND32V/CE1M.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Xanh Rêu Đậm', '#2E4D38', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw4b3664ac/images/VF8/ND32V/CE22.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Xám nóc Bạc', '#5F6363', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw4e812595/images/VF8/ND32V/171V.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Trắng nóc Xám', '#FFFFFF', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw68478647/images/VF8/ND32V/1V18.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Đỏ Đậm nóc Đồng', '#7A1C29', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwc25632a9/images/VF8/ND32V/2927.png'),
  (gen_random_uuid(), 'VF8', 'Tiêu chuẩn', 'Đen nóc Đồng', '#1A1A1A', 999000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw336f414c/images/VF8/ND32V/2911.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Trắng Tinh Khôi', '#FFFFFF', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw461c334b/images/VF8/ND32V/CE18.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Đen Huyền Bí', '#1A1A1A', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw76734143/images/VF8/ND32V/CE11.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Đỏ Thẫm Quý Phái', '#BA0C2F', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw0b574681/images/VF8/ND32V/CE1M.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Xanh Rêu Đậm', '#2E4D38', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw4b3664ac/images/VF8/ND32V/CE22.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Xám nóc Bạc', '#5F6363', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw4e812595/images/VF8/ND32V/171V.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Trắng nóc Xám', '#FFFFFF', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw68478647/images/VF8/ND32V/1V18.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Đỏ Đậm nóc Đồng', '#7A1C29', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwc25632a9/images/VF8/ND32V/2927.png'),
  (gen_random_uuid(), 'VF8', 'Plus', 'Đen nóc Đồng', '#1A1A1A', 1059000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw336f414c/images/VF8/ND32V/2911.png'),
  (gen_random_uuid(), 'VF9', 'Tiêu chuẩn', 'Trắng Tinh Khôi', '#FFFFFF', 1399000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe861d018/images/VF9/NE3NV/CE18.png'),
  (gen_random_uuid(), 'VF9', 'Tiêu chuẩn', 'Đen Huyền Bí', '#1A1A1A', 1399000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa0d506d6/images/VF9/NE3NV/CE11.png'),
  (gen_random_uuid(), 'VF9', 'Tiêu chuẩn', 'Bạc Ánh Kim', '#C0C0C0', 1399000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwcaee8de4/images/VF9/NE3NV/CE17.png'),
  (gen_random_uuid(), 'VF9', 'Tiêu chuẩn', 'Xám Tinh Tế', '#5F6363', 1399000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw72fbcd05/images/VF9/NE3NV/CE1V.png'),
  (gen_random_uuid(), 'VF9', 'Tiêu chuẩn', 'Xanh Bạc Hà', '#7CB3A3', 1399000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw29074c9e/images/VF9/NE3NV/CE1W.png'),
  (gen_random_uuid(), 'VF9', 'Tiêu chuẩn', 'Đỏ Thẫm Quý Phái', '#BA0C2F', 1399000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwb97545ea/images/VF9/NE3NV/CE1M.png'),
  (gen_random_uuid(), 'VF9', 'Tiêu chuẩn', 'Xanh Rêu Đậm', '#2E4D38', 1399000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw19ebd8dd/images/VF9/NE3NV/CE22.png'),
  (gen_random_uuid(), 'VF9', 'Plus', 'Trắng Tinh Khôi', '#FFFFFF', 1499000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwe861d018/images/VF9/NE3NV/CE18.png'),
  (gen_random_uuid(), 'VF9', 'Plus', 'Đen Huyền Bí', '#1A1A1A', 1499000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwa0d506d6/images/VF9/NE3NV/CE11.png'),
  (gen_random_uuid(), 'VF9', 'Plus', 'Bạc Ánh Kim', '#C0C0C0', 1499000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwcaee8de4/images/VF9/NE3NV/CE17.png'),
  (gen_random_uuid(), 'VF9', 'Plus', 'Xám Tinh Tế', '#5F6363', 1499000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw72fbcd05/images/VF9/NE3NV/CE1V.png'),
  (gen_random_uuid(), 'VF9', 'Plus', 'Xanh Bạc Hà', '#7CB3A3', 1499000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw29074c9e/images/VF9/NE3NV/CE1W.png'),
  (gen_random_uuid(), 'VF9', 'Plus', 'Đỏ Thẫm Quý Phái', '#BA0C2F', 1499000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dwb97545ea/images/VF9/NE3NV/CE1M.png'),
  (gen_random_uuid(), 'VF9', 'Plus', 'Xanh Rêu Đậm', '#2E4D38', 1499000000, '2025-Q4-v1', '2025-10-01', 'https://shop.vinfastauto.com/on/demandware.static/-/Sites-vinfast_vn_master/default/dw19ebd8dd/images/VF9/NE3NV/CE22.png')
ON CONFLICT DO NOTHING;

-- Battery prices
INSERT INTO battery_prices (model,buy_price,rent_price) VALUES
  ('VF3',        0,  700000),
  ('VF5', 50000000, 1490000),
  ('VF6', 60000000, 1690000),
  ('VF7', 80000000, 1990000),
  ('VF8',120000000, 2490000),
  ('VF9',180000000, 3490000)
ON CONFLICT (model) DO NOTHING;

-- Accessories
INSERT INTO accessories (code,name,price) VALUES
  ('ppf',            'Phim cách nhiệt PPF',  15000000),
  ('dashcam',        'Camera hành trình',      4500000),
  ('cam_360',        'Camera 360°',            8000000),
  ('floor_mat',      'Thảm lót sàn 3D',        3500000),
  ('screen_prot',    'Dán màn hình',           1500000),
  ('parking_sensor', 'Cảm biến lùi',           2500000)
ON CONFLICT (code) DO NOTHING;

-- Rolling costs
INSERT INTO rolling_costs (province,registration_rate,road_fee,inspection_fee,insurance_rate,plate_fee) VALUES
  ('Hà Nội',          0.12, 1560000, 340000, 0.015, 20000000),
  ('TP. Hồ Chí Minh', 0.10, 1560000, 340000, 0.015, 20000000),
  ('Đà Nẵng',         0.10, 1560000, 340000, 0.015,  2000000),
  ('Hải Phòng',       0.10, 1560000, 340000, 0.015,  2000000),
  ('Cần Thơ',         0.10, 1560000, 340000, 0.015,  2000000),
  ('Bình Dương',      0.10, 1560000, 340000, 0.015,  2000000),
  ('Tỉnh khác',       0.10, 1560000, 340000, 0.015,  2000000)
ON CONFLICT (province) DO NOTHING;

-- Promotions
INSERT INTO promotions (name,description,model,province,discount_type,discount_value,start_date,end_date,is_active,usage_count) VALUES
  ('Ưu đãi tháng 10 - VF6', 'Giảm 30tr cho VF6 tháng 10',     'VF6', NULL,      'fixed',   30000000, '2025-10-01','2025-10-31', TRUE,  47),
  ('Tặng gói sạc - Mỹ Đình', 'Tặng gói sạc 1 năm tại Mỹ Đình', 'ALL','Hà Nội', 'fixed',    5000000, '2025-10-01','2025-12-31', TRUE,  21),
  ('Ưu đãi VF8 cuối năm',    'Giảm 50tr VF8 Plus Q4',          'VF8', NULL,      'fixed',   50000000, '2025-11-01','2025-12-31', TRUE,   0)
ON CONFLICT DO NOTHING;
