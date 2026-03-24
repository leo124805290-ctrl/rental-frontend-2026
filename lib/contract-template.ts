/**
 * 房屋租賃契約暨入住公約（HTML 片段，供列印／PDF）
 */
export function generateContract(data: {
  landlordName: string;
  tenantName: string;
  roomNumber: string;
  propertyAddress: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  electricityRate: number;
}): string {
  return `
    <div class="contract-doc space-y-4 text-sm leading-relaxed text-slate-800">
      <h1 class="text-center text-lg font-bold">房屋租賃契約暨入住公約</h1>
      <p class="text-center text-sm text-slate-600">Hợp đồng thuê nhà và Thỏa thuận nhận phòng</p>

      <section>
        <h2 class="font-semibold">【當事人資訊 / Thông tin các bên】</h2>
        <p>出租人（甲方）/ Bên cho thuê (Bên A)：${escapeHtml(data.landlordName)}</p>
        <p>承租人（乙方）/ Bên thuê (Bên B)：${escapeHtml(data.tenantName)}</p>
      </section>

      <section>
        <h2 class="font-semibold">【租賃標的與期限 / Đối tượng và Thời hạn thuê】</h2>
        <p>1. 房屋所在地：${escapeHtml(data.propertyAddress)}，房間號碼 ${escapeHtml(data.roomNumber)}</p>
        <p>2. 租賃期限：自 ${escapeHtml(data.startDate)} 起至 ${escapeHtml(data.endDate)} 止</p>
      </section>

      <section>
        <h2 class="font-semibold">【租金與費用說明 / Phí thuê và Các chi phí khác】</h2>
        <p>1. 每月租金：新台幣 ${data.monthlyRent.toLocaleString('zh-TW')} 元整</p>
        <p>2. 押金：新台幣 ${data.deposit.toLocaleString('zh-TW')} 元整</p>
        <p>3. 電費：依各房電表計算，每度 ${data.electricityRate} 元</p>
      </section>

      <section>
        <h2 class="font-semibold">【入住公約與生活守則 / Thỏa thuận nhận phòng và Quy định sinh hoạt】</h2>
        <p>1. 垃圾處理：垃圾請務必打包帶至工廠或垃圾車丟棄，嚴禁隨意亂丟。違反者罰款 1,000 元。<br/>
           Xử lý rác: Rác phải được đóng gói và mang đến nhà máy hoặc xe rác. Vi phạm phạt 1.000 tệ.</p>
        <p>2. 環境衛生：公共區域嚴禁擺放私人物品。若環境髒亂，將收取每人 100 元清潔費。<br/>
           Vệ sinh môi trường: Nghiêm cấm để đồ cá nhân ở khu vực công cộng.</p>
        <p>3. 排水維護：嚴禁將垃圾、廚餘丟入馬桶或洗臉盆。若造成堵塞，維修費用由全體房客平均分攤。<br/>
           Bảo trì thoát nước: Không vứt rác, thức ăn thừa vào bồn cầu/bồn rửa.</p>
        <p>4. 訪客管理：嚴禁帶非宿舍人員進出。鬧事者須於 3 日內搬離，且不退還押金。<br/>
           Quản lý khách: Nghiêm cấm đưa người ngoài vào.</p>
      </section>

      <section>
        <h2 class="font-semibold">【違約責任與合約終止 / Trách nhiệm vi phạm và Chấm dứt hợp đồng】</h2>
        <p>1. 提前終止：租期未滿欲終止合約，須提前一個月通知並經對方同意，且須賠償一個月租金。<br/>
           Chấm dứt sớm: Phải thông báo trước 1 tháng và bồi thường 1 tháng tiền thuê.</p>
        <p>2. 遷出規定：遷出時須返還鑰匙與合約。遺留物視為放棄，由甲方處理。<br/>
           Quy định chuyển đi: Trả lại chìa khóa và hợp đồng.</p>
      </section>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
