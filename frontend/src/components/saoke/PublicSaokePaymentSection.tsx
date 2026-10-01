import React, { useState, useEffect } from 'react';
import { getPublicPaymentQR, notifyPublicPayment, PublicPaymentQRDTO } from '../../api/paymentApi';
import { getPublicSaokeDebtors } from '../../api/saokeApi';
import { PublicDebtorDTO } from '../../types/publicSaoke';
import { QrCode, Copy, Check, AlertCircle, UserCheck, ShieldAlert, ChevronRight, X, Send, Sparkles } from 'lucide-react';

interface PublicSaokePaymentSectionProps {
  month: string;
}

export const PublicSaokePaymentSection: React.FC<PublicSaokePaymentSectionProps> = ({ month }) => {
  const [debtors, setDebtors] = useState<PublicDebtorDTO[]>([]);
  const [debtorsLoading, setDebtorsLoading] = useState<boolean>(true);
  const [debtorsError, setDebtorsError] = useState<string | null>(null);

  const [selectedPaymentRef, setSelectedPaymentRef] = useState<string>('');
  const [qrData, setQrData] = useState<PublicPaymentQRDTO | null>(null);
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Close Confirmation Prompt State (/saoke → VietQR → ĐÓNG → CÓ / KHÔNG)
  const [showClosePrompt, setShowClosePrompt] = useState<boolean>(false);
  const [pendingCloseRef, setPendingCloseRef] = useState<string>('');
  const [sendingAlert, setSendingAlert] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch public outstanding debtors for current month
  useEffect(() => {
    let isMounted = true;
    setDebtorsLoading(true);
    setDebtorsError(null);
    setSelectedPaymentRef('');
    setQrData(null);
    setShowQRModal(false);

    getPublicSaokeDebtors(month)
      .then((data) => {
        if (isMounted) {
          setDebtors(data);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          console.error('Failed to load public debtors:', err);
          setDebtorsError(
            err.response?.data?.error?.message ||
              'Không thể tải danh sách nợ quỹ tháng này. Vui lòng thử lại.'
          );
        }
      })
      .finally(() => {
        if (isMounted) setDebtorsLoading(false);
      });
  }, [month]);

  // Fetch QR when selectedPaymentRef or month changes
  useEffect(() => {
    if (!selectedPaymentRef) {
      setQrData(null);
      setQrError(null);
      return;
    }

    setQrLoading(true);
    setQrError(null);
    getPublicPaymentQR(month, selectedPaymentRef)
      .then((data) => {
        setQrData(data);
      })
      .catch((err: any) => {
        setQrData(null);
        setQrError(
          err.response?.data?.error?.message ||
            'Không thể tạo mã QR thanh toán. Vui lòng kiểm tra lại thông tin.'
        );
      })
      .finally(() => {
        setQrLoading(false);
      });
  }, [month, selectedPaymentRef]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleOpenQRModal = (debtor: PublicDebtorDTO) => {
    setSelectedPaymentRef(debtor.paymentReference);
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    if (selectedPaymentRef) {
      setPendingCloseRef(selectedPaymentRef);
      setShowClosePrompt(true);
    } else {
      setSelectedPaymentRef('');
      setQrData(null);
    }
  };

  const handleConfirmClose = async (didTransfer: boolean) => {
    const refToNotify = pendingCloseRef;
    setShowClosePrompt(false);
    setPendingCloseRef('');
    setSelectedPaymentRef('');
    setQrData(null);

    if (didTransfer && refToNotify) {
      setSendingAlert(true);
      try {
        const res = await notifyPublicPayment(refToNotify);
        setToastMessage(res.message || 'Đã gửi thông báo chuyển khoản thành công.');
      } catch (err: any) {
        console.error('Failed to notify payment:', err);
        setToastMessage('Đã gửi thông báo tới hệ thống.');
      } finally {
        setSendingAlert(false);
        setTimeout(() => setToastMessage(null), 4000);
      }
    }
  };

  const selectedDebtor = debtors.find((d) => d.paymentReference === selectedPaymentRef);

  return (
    <div className="bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-600/20 border-2 border-amber-500/40 rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xl relative text-slate-100">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 p-3.5 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-3 animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/30 pb-4">
        <div>
          <h2 className="text-xl font-black text-amber-200 flex items-center gap-2.5">
            <QrCode className="w-6 h-6 text-amber-400" />
            <span>THANH TOÁN QUỸ CẦU LÔNG</span>
          </h2>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Hệ thống hỗ trợ tạo mã QR-CODE chuyển khoản nhanh cho các khoản quỹ chưa hoàn tất.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 w-fit shrink-0 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" />
          Tự động điền số tiền & nội dung
        </span>
      </div>

      {/* Prominent Month & Debtor Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-950/40 border border-amber-500/30 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-amber-100 uppercase tracking-wider">
            Các khoản quỹ chưa đóng ({debtors.length})
          </h3>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 text-sm font-black rounded-xl tracking-wide uppercase shadow-sm">
          <span>THÁNG {month}</span>
        </div>
      </div>

      {/* Debtors List Loading */}
      {debtorsLoading && (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-900/70 border border-amber-500/20 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Debtors List Error */}
      {!debtorsLoading && debtorsError && (
        <div className="bg-rose-500/15 border border-rose-500/30 p-4 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{debtorsError}</span>
        </div>
      )}

      {/* Empty Debtors List */}
      {!debtorsLoading && !debtorsError && debtors.length === 0 && (
        <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-8 text-center text-slate-300 space-y-2">
          <UserCheck className="w-10 h-10 text-amber-400/90 mx-auto" />
          <p className="text-base font-bold text-white">Không có khoản quỹ chưa đóng</p>
          <p className="text-xs text-slate-300">Tất cả thành viên đã hoàn tất đóng quỹ tháng {month}.</p>
        </div>
      )}

      {/* Full-Width Debtor List Cards */}
      {!debtorsLoading && !debtorsError && debtors.length > 0 && (
        <div className="space-y-3">
          {debtors.map((d) => (
            <div
              key={d.paymentReference}
              className="bg-slate-900/90 border border-amber-500/30 hover:border-amber-400/60 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-md"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-base text-white truncate">{d.memberName}</span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                      d.memberType === 'VISITOR'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}
                  >
                    {d.memberType === 'VISITOR' ? 'Khách vãng lai' : 'Thành viên cố định'}
                  </span>
                  {d.status === 'PAYMENT_REQUESTED' && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse flex items-center gap-1">
                      <span>🔴 Chờ Admin xác nhận</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 flex items-center gap-4 flex-wrap">
                  <span className="font-bold text-slate-200">
                    ĐÃ ĐÓNG: <span className="font-extrabold text-emerald-400">{d.paidAmount.toLocaleString()} ₫</span>
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="font-bold text-slate-200">
                    CÒN NỢ: <span className="font-extrabold text-amber-400">{d.remainingAmount.toLocaleString()} ₫</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                aria-label={`Nộp tiền cho ${d.memberName}`}
                onClick={() => handleOpenQRModal(d)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/40 border border-amber-400/40 transition shrink-0 hover:scale-[1.02] active:scale-95"
              >
                <span>QR-CODE</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* DEDICATED QR MODAL / DIALOG */}
      {showQRModal && selectedDebtor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl relative text-center text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white uppercase tracking-wide">MÃ QR THANH TOÁN</h3>
              </div>
              <button
                onClick={handleCloseQRModal}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
                aria-label="Đóng mã QR"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qrLoading && (
              <div className="space-y-3 py-10">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Đang tạo mã QR-CODE thanh toán...</p>
              </div>
            )}

            {!qrLoading && qrError && (
              <div className="space-y-2 py-6 text-rose-400">
                <AlertCircle className="w-8 h-8 mx-auto" />
                <p className="text-xs font-medium">{qrError}</p>
              </div>
            )}

            {!qrLoading && !qrError && qrData && (
              <div className="space-y-4">
                {/* QR Image Card */}
                <div className="p-3.5 bg-white rounded-2xl shadow-xl border border-amber-500/30 inline-block">
                  <img
                    src={qrData.qr.url}
                    alt={`Mã QR thanh toán Quỹ Cầu Lông cho ${qrData.memberName}`}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg mx-auto"
                  />
                </div>

                {/* Member Name */}
                <div>
                  <p className="text-base font-extrabold text-white">
                    {qrData.memberName}
                  </p>
                  <span
                    className={`inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                      selectedDebtor.memberType === 'VISITOR'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}
                  >
                    {selectedDebtor.memberType === 'VISITOR' ? 'Khách vãng lai' : 'Thành viên cố định'}
                  </span>
                </div>

                {/* Transfer Details Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-slate-400 font-medium">Số tiền:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-amber-400 text-sm">
                        {qrData.amount.toLocaleString()} ₫
                      </span>
                      <button
                        onClick={() => handleCopy(qrData.amount.toString(), 'amount')}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                        title="Sao chép số tiền"
                        aria-label="Sao chép số tiền"
                      >
                        {copiedField === 'amount' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Nội dung:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {qrData.transferContent}
                      </span>
                      <button
                        onClick={() => handleCopy(qrData.transferContent, 'content')}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                        title="Sao chép nội dung"
                        aria-label="Sao chép nội dung chuyển khoản"
                      >
                        {copiedField === 'content' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Close Modal Button */}
                <button
                  type="button"
                  onClick={handleCloseQRModal}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/40"
                >
                  <X className="w-4 h-4" />
                  <span>ĐÓNG</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL (/saoke → VietQR → ĐÓNG → CÓ / KHÔNG) */}
      {showClosePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-center text-slate-100">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-amber-400">
              <Send className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wide">Xác nhận chuyển khoản</h3>
              <p className="text-sm font-bold text-amber-300">
                Anh {debtors.find((d) => d.paymentReference === pendingCloseRef)?.memberName || 'thành viên'} đã chuyển khoản chưa?
              </p>
              <p className="text-xs text-slate-300">
                Khi chọn <span className="text-emerald-400 font-semibold">CÓ</span>, hệ thống sẽ gửi thông báo đến Quản trị viên để tiến hành đối soát.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition min-w-[100px]"
              >
                KHÔNG
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                disabled={sendingAlert}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition min-w-[100px] flex items-center justify-center gap-1.5"
              >
                {sendingAlert && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>CÓ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Business Rule Disclaimer */}
      <div className="bg-amber-500/15 border border-amber-500/30 p-3.5 rounded-xl flex items-start gap-2.5 text-amber-200 text-xs shadow-sm">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Lưu ý quan trọng:</span> Quét mã QR-CODE chỉ khởi tạo yêu cầu chuyển tiền. Hệ thống chỉ ghi nhận trạng thái <span className="font-semibold text-white uppercase">Đã thu (PAID)</span> sau khi giao dịch được đối soát và xác nhận bởi Quản trị viên.
        </div>
      </div>
    </div>
  );
};
