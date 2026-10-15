import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Bot, Check, ChevronRight, Compass, FileText, MapPin, Phone, Rotate3d, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { CarImage } from "@/components/shared/car-image";
import { NewsletterForm } from "@/components/landing/newsletter-form";
import { BRAND } from "@/lib/brand";
import { VEHICLES } from "@/lib/vehicle-data";
import { getServerCatalog, getServerDealers } from "@/lib/server-catalog";
import { formatNumber } from "@/lib/format";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: BRAND.siteTitle,
  description: "Khám phá dòng xe điện VinFast, tự tạo cấu hình, xem chi phí dự kiến và kết nối với đại lý phù hợp.",
};

const JOURNEY = [
  { icon: Compass, title: "Tìm chiếc xe phù hợp", text: "Bắt đầu từ không gian cấu hình và lựa chọn dòng xe theo nhu cầu của bạn." },
  { icon: SlidersHorizontal, title: "Cá nhân hóa từng chi tiết", text: "Chọn phiên bản, màu sắc, pin và phụ kiện. Xem chi phí thay đổi cùng lựa chọn." },
  { icon: Bot, title: "Hỏi thêm, quyết định dễ hơn", text: "Trao đổi với trợ lý AI, dự toán trả góp và gửi yêu cầu báo giá đến đại lý." },
];

export default async function Landing() {
  const [catalog, dealers] = await Promise.all([getServerCatalog(), getServerDealers()]);
  const featuredKey = BRAND.featured;
  const featured = catalog?.vehicles[featuredKey] ?? VEHICLES[featuredKey];
  const featuredFrom = Math.min(...featured.versions.map((version) => version.price));

  return (
    <div className={styles.page}>
      <LandingNav />
      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> CÙNG BẠN MỞ LỐI TƯƠNG LAI</div>
            <h1 id="hero-title">Hành trình mới.<br /><span>Dấu ấn của bạn.</span></h1>
            <p>Một chiếc xe phù hợp. Một hành trình của riêng bạn. Khám phá thế giới xe điện VinFast và tự tạo nên lựa chọn lý tưởng.</p>
            <div className={styles.heroActions}>
              <Link href="/configurator" className={styles.primaryButton}>Thiết kế xe của bạn <ArrowUpRight size={18} /></Link>
              <Link href="#trai-nghiem" className={styles.textButton}>Khám phá trải nghiệm <ArrowDown size={15} /></Link>
            </div>
            <div className={styles.heroNote}><Check size={14} /> Tùy chỉnh trực quan <span>·</span> Chi phí rõ ràng <span>·</span> Tư vấn AI</div>
          </div>
          <div className={styles.heroStage}>
            <div className={styles.heroOrbit} aria-hidden="true" />
            <span className={styles.heroModel} aria-hidden="true">{featured.label.replace(" ", "")}</span>
            <div className={styles.electricBadge}><Zap size={13} fill="currentColor" /> THUẦN ĐIỆN. ĐẦY CẢM HỨNG.</div>
            <CarImage model={featuredKey} colorId={featured.colors[0].id} alt={`VinFast ${featured.label}`} className={styles.heroCar} />
            <div className={styles.heroVehicleInfo}>
              <div><span>KHÁM PHÁ TIÊU ĐIỂM</span><strong>VinFast {featured.label}</strong></div>
              <Link href="/configurator" aria-label="Bắt đầu trải nghiệm cấu hình"><ArrowUpRight size={22} /></Link>
            </div>
          </div>
          <div className={styles.heroBottom}>
            <div className={styles.scrollHint}><span><ArrowDown size={15} /></span> Khám phá theo cách của bạn</div>
            <p>{catalog ? "Giá tham khảo từ" : "Giá dự phòng từ"} <strong>{formatNumber(featuredFrom)} ₫</strong><span>Chưa gồm pin và chi phí lăn bánh</span></p>
          </div>
        </section>

        <section id="trai-nghiem" className={styles.experience} aria-labelledby="experience-title">
          <div className={styles.sectionTop}>
            <div><p className={styles.eyebrow}>TRẢI NGHIỆM TRƯỚC KHI QUYẾT ĐỊNH</p><h2 id="experience-title">Hiểu chiếc xe.<br />Theo cách của bạn.</h2></div>
            <p className={styles.sectionIntro}>Dành thời gian khám phá, so sánh các lựa chọn và hiểu rõ ngân sách trước khi kết nối với đại lý.</p>
          </div>
          <div className={styles.experienceGrid}>
            <article className={styles.experienceCard}>
              <div className={`${styles.experienceVisual} ${styles.previewVisual}`} aria-hidden="true"><div className={styles.previewOrbit}><Rotate3d size={48} strokeWidth={1} /></div><span>360°</span><div className={styles.previewCaption}>MỖI GÓC NHÌN. MỘT CẢM NHẬN.</div></div>
              <span className={styles.featureNumber}>01 / TRỰC QUAN</span><h3>Ngắm nhìn từng góc xe.</h3><p>Xoay mô hình 3D, thử màu ngoại thất và hình dung chiếc xe theo sở thích của bạn.</p>
            </article>
            <article className={styles.experienceCard}>
              <div className={`${styles.experienceVisual} ${styles.costVisual}`} aria-hidden="true"><div className={styles.costSheet}><span>CHI PHÍ DỰ KIẾN</span><div><span>Giá xe & pin</span><span>Theo lựa chọn</span></div><div><span>Phụ kiện</span><span>Theo cấu hình</span></div><div><span>Đăng ký xe</span><span>Theo địa phương</span></div><strong>Rõ từng khoản chi phí <Check size={14} /></strong></div></div>
              <span className={styles.featureNumber}>02 / MINH BẠCH</span><h3>Chủ động với ngân sách.</h3><p>Xem từng khoản trong dự toán lăn bánh và thử phương án trả góp phù hợp với kế hoạch của bạn.</p>
            </article>
            <article className={styles.experienceCard}>
              <div className={`${styles.experienceVisual} ${styles.documentVisual}`} aria-hidden="true"><div className={styles.documentSheet}><FileText size={31} strokeWidth={1.2} /><span>BÁO GIÁ CỦA BẠN</span><i /><i /><i /><span className={styles.pdfBadge}>PDF <ArrowDown size={11} /></span></div></div>
              <span className={styles.featureNumber}>03 / THUẬN TIỆN</span><h3>Mang lựa chọn đến đại lý.</h3><p>Lưu báo giá theo cấu hình để trao đổi cùng tư vấn viên và xác nhận thông tin trước khi mua xe.</p>
            </article>
          </div>
          <div className={styles.experienceFooter}><p>Cấu hình, tư vấn và báo giá trong cùng một hành trình.</p><Link href="/configurator" className={styles.textButton}>Mở không gian cấu hình <ArrowUpRight size={17} /></Link></div>
        </section>

        <section id="cong-cu" className={styles.journey} aria-labelledby="journey-title">
          <div className={styles.journeyHeading}><div><p className={styles.eyebrow}>TỪ Ý TƯỞNG ĐẾN CHIẾC XE CỦA BẠN</p><h2 id="journey-title">Mọi lựa chọn.<br />Trong một không gian.</h2></div><Link href="/configurator" className={styles.outlineButton}>Bắt đầu trải nghiệm <ArrowUpRight size={17} /></Link></div>
          <div className={styles.journeyGrid}>
            {JOURNEY.map(({ icon: Icon, title, text }, index) => <div key={title} className={styles.journeyItem}><div className={styles.journeyIcon}><Icon size={25} strokeWidth={1.35} /><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></div>)}
          </div>
        </section>

        <section id="uu-dai" className={styles.assistant} aria-labelledby="assistant-title">
          <div className={styles.assistantVisual} aria-hidden="true"><div className={styles.assistantGlow} /><div className={styles.assistantOrb}><Sparkles size={48} strokeWidth={1} /></div><span className={styles.assistantTag}><span /> TRỢ LÝ CỦA BẠN</span><div className={styles.sampleQuestion}>“Chi phí lăn bánh gồm những gì?”</div><div className={styles.sampleAnswer}><Bot size={20} /><span>Cùng tìm hiểu từng khoản chi phí.</span></div></div>
          <div className={styles.assistantCopy}><p className={styles.eyebrow}>THÊM THẤU HIỂU. THÊM AN TÂM.</p><h2 id="assistant-title">Bạn có câu hỏi.<br />Trợ lý luôn sẵn sàng.</h2><p>Giá xe, ưu đãi, lựa chọn pin hay dự toán trả góp? Trao đổi ngay trong lúc cấu hình để hiểu rõ hơn về chiếc xe bạn đang chọn.</p><Link href="/configurator" className={styles.primaryButton}>Cấu hình & trò chuyện <ArrowUpRight size={17} /></Link><span className={styles.assistantDisclaimer}>Thông tin tư vấn mang tính tham khảo; đại lý xác nhận báo giá cuối cùng.</span></div>
        </section>

        <section id="showroom" className={styles.showrooms} aria-labelledby="showroom-title">
          <div className={styles.sectionTop}><div><p className={styles.eyebrow}>GẦN BẠN HƠN MỘT BƯỚC</p><h2 id="showroom-title">Kết nối. Cảm nhận. Lái thử.</h2></div><p className={styles.sectionIntro}>Gặp gỡ đội ngũ tư vấn, tận mắt khám phá chiếc xe và trao đổi lịch lái thử tại đại lý.</p></div>
          {dealers?.length ? <div className={styles.dealerGrid}>{dealers.map((dealer) => <article className={styles.dealerCard} key={dealer.id}><div className={styles.dealerLocation}><MapPin size={15} /><span>{dealer.province}</span></div><h3>{dealer.name}</h3><p>{dealer.address ?? "Liên hệ đại lý để xác nhận địa chỉ."}</p><div className={styles.dealerFooter}>{dealer.phone ? <a href={`tel:${dealer.phone.replace(/[^+\d]/g, "")}`}><Phone size={13} />{dealer.phone}</a> : <span>Liên hệ qua yêu cầu tư vấn</span>}<Link href={`/configurator?dealer=${encodeURIComponent(dealer.id)}`} aria-label={`Chọn ${dealer.name} để tư vấn`}><ChevronRight size={18} /></Link></div></article>)}</div> : <p className={styles.emptyDealers}>{dealers ? "Danh mục đại lý đang được cập nhật." : "Chưa tải được danh mục đại lý. Vui lòng thử lại sau."}</p>}
          <p className={styles.priceNote}>Vui lòng liên hệ đại lý để xác nhận tồn kho, giờ mở cửa và lịch lái thử trước khi đến.</p>
        </section>

        <section className={styles.newsletter} aria-labelledby="newsletter-title"><div><p className={styles.eyebrow}>GIỮ KẾT NỐI</p><h2 id="newsletter-title">Cảm hứng cho<br />hành trình tiếp theo.</h2><p>Đăng ký nhận thông tin về xe và chương trình từ đại lý.</p></div><div className={styles.newsletterForm}><NewsletterForm /></div></section>
      </main>
      <footer className={styles.footer}><div className={styles.footerTop}><Link href="/" className={styles.footerBrand}>{BRAND.name}<span>CHUYỂN ĐỘNG THEO CÁCH CỦA BẠN.</span></Link><div><Link href="/#trai-nghiem">Khám phá trải nghiệm</Link><Link href="/configurator">Cấu hình xe</Link><Link href="/login">Dành cho nhân viên</Link></div></div><div className={styles.footerBottom}><p>Công cụ khám phá, tư vấn và dự toán chi phí xe điện.</p><p>Hình ảnh minh họa. Báo giá chính thức do đại lý xác nhận.</p></div></footer>
    </div>
  );
}
