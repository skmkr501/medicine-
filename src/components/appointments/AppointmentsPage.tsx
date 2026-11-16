import React, { useState, useEffect } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { DoctorAppointment } from '../../types';
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Stethoscope,
  X,
  Share2,
  Edit2,
  Loader2,
} from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const {
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    patients,
    activePatientId,
    setActivePatientId,
    settings,
    isLoadingPastAppointments,
    loadPastAppointments,
  } = useMedicine();

  useEffect(() => {
    loadPastAppointments();
  }, []);

  const isBn = settings.language !== 'en';

  const [selectedFilterPatient, setSelectedFilterPatient] = useState<string>(activePatientId || 'all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<DoctorAppointment | null>(null);

  // Form states
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [formPatientId, setFormPatientId] = useState<string>(activePatientId || patients[0]?.id || '');

  // Filtered appointments
  const filteredAppointments = appointments.filter((app) => {
    if (selectedFilterPatient === 'all') return true;
    return app.patientId === selectedFilterPatient;
  });

  // Sort upcoming vs past
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const upcomingAppointments = filteredAppointments
    .filter((a) => a.status === 'upcoming' && a.appointmentDate >= todayStr)
    .sort((a, b) => `${a.appointmentDate} ${a.appointmentTime}`.localeCompare(`${b.appointmentDate} ${b.appointmentTime}`));

  const pastAppointments = filteredAppointments
    .filter((a) => a.status === 'completed' || a.appointmentDate < todayStr)
    .sort((a, b) => `${b.appointmentDate} ${b.appointmentTime}`.localeCompare(`${a.appointmentDate} ${a.appointmentTime}`));

  const openAddModal = () => {
    setEditingAppointment(null);
    setDoctorName('');
    setSpecialty('');
    setAppointmentDate(todayStr);
    setAppointmentTime('10:00 AM');
    setLocation('');
    setNotes('');
    setFormPatientId(selectedFilterPatient === 'all' ? (activePatientId || patients[0]?.id || '') : selectedFilterPatient);
    setIsModalOpen(true);
  };

  const openEditModal = (app: DoctorAppointment) => {
    setEditingAppointment(app);
    setDoctorName(app.doctorName);
    setSpecialty(app.specialty || '');
    setAppointmentDate(app.appointmentDate);
    setAppointmentTime(app.appointmentTime);
    setLocation(app.location || '');
    setNotes(app.notes || '');
    setFormPatientId(app.patientId || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim() || !appointmentDate || !appointmentTime) return;

    if (editingAppointment) {
      updateAppointment(editingAppointment.id, {
        patientId: formPatientId || undefined,
        doctorName: doctorName.trim(),
        specialty: specialty.trim() || undefined,
        appointmentDate,
        appointmentTime: appointmentTime.trim(),
        location: location.trim() || 'চেম্বার',
        notes: notes.trim() || undefined,
      });
    } else {
      addAppointment({
        patientId: formPatientId || undefined,
        doctorName: doctorName.trim(),
        specialty: specialty.trim() || undefined,
        appointmentDate,
        appointmentTime: appointmentTime.trim(),
        location: location.trim() || 'চেম্বার',
        notes: notes.trim() || undefined,
        status: 'upcoming',
      });
    }

    setIsModalOpen(false);
  };

  const getPatientName = (patientId?: string) => {
    if (!patientId) return isBn ? 'সদস্য' : 'Member';
    const p = patients.find((pat) => pat.id === patientId);
    return p ? p.name : isBn ? 'সদস্য' : 'Member';
  };

  // Check if native APK reminders bridge exists
  const hasNativeBridge = typeof (window as unknown as { AndroidReminders?: unknown }).AndroidReminders !== 'undefined';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            {isBn ? 'ডাক্তারের অ্যাপয়েন্টমেন্ট' : 'Doctor Appointments'}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {isBn
              ? 'ডাক্তারের সাক্ষাতের সময়সূচি ও আগের দিনের ড্যাশবোর্ড সতর্কতা'
              : 'Schedule doctor visits and get timely dashboard reminders'}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl font-medium shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {isBn ? 'নতুন অ্যাপয়েন্টমেন্ট' : 'Add Appointment'}
        </button>
      </div>

      {/* Patient Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedFilterPatient('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
            selectedFilterPatient === 'all'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface text-text-muted border border-border hover:bg-surface-2'
          }`}
        >
          {isBn ? 'সব সদস্য' : 'All Members'}
        </button>
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedFilterPatient(p.id);
              setActivePatientId(p.id);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 cursor-pointer ${
              selectedFilterPatient === p.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface text-text-muted border border-border hover:bg-surface-2'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${selectedFilterPatient === p.id ? 'bg-on-primary' : 'bg-primary'}`}></span>
            {p.name}
          </button>
        ))}
      </div>

      {/* APK Integration status note if present */}
      {hasNativeBridge && (
        <div className="p-3.5 bg-success-soft border border-success/30 rounded-xl text-sm text-success-text flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-success-text" />
          <span>
            {isBn
              ? 'ফোনের নিজস্ব অ্যালার্ম সক্রিয়: ডাক্তারের অ্যাপয়েন্টমেন্ট মনে করিয়ে দেওয়া হবে।'
              : 'Device alarm active: Appointment reminders will alert on your phone.'}
          </span>
        </div>
      )}

      {/* Upcoming Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text">
            {isBn ? 'আসন্ন অ্যাপয়েন্টমেন্ট' : 'Upcoming Appointments'}
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-soft text-primary">
            {upcomingAppointments.length}
          </span>
        </div>

        {upcomingAppointments.length === 0 ? (
          <div className="bg-surface p-8 rounded-2xl border border-dashed border-border text-center">
            <Stethoscope className="w-12 h-12 text-text-muted opacity-50 mx-auto mb-3" />
            <p className="text-text font-medium">
              {isBn ? 'কোনো আসন্ন অ্যাপয়েন্টমেন্ট নেই' : 'No upcoming appointments scheduled'}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {isBn ? 'নতুন অ্যাপয়েন্টমেন্ট যোগ করতে উপরের বাটনে ক্লিক করুন।' : 'Click the button above to add a visit schedule.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingAppointments.map((app) => {
              const isToday = app.appointmentDate === todayStr;
              const tom = new Date(now);
              tom.setDate(tom.getDate() + 1);
              const tomStr = tom.toISOString().split('T')[0];
              const isTomorrow = app.appointmentDate === tomStr;

              return (
                <div
                  key={app.id}
                  className={`bg-surface rounded-2xl p-5 border shadow-sm transition hover:shadow-md ${
                    isToday
                      ? 'border-warning/70 ring-2 ring-warning/20'
                      : isTomorrow
                      ? 'border-primary'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2 py-0.5 text-xs rounded-md bg-surface-2 text-text-muted font-medium">
                          {getPatientName(app.patientId)}
                        </span>
                        {isToday && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-warning-soft text-warning-text flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {isBn ? 'আজকের সাক্ষাৎ' : 'Today'}
                          </span>
                        )}
                        {isTomorrow && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-primary-soft text-primary">
                            {isBn ? 'আগামীকাল' : 'Tomorrow'}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-text flex items-center gap-2">
                        {app.doctorName}
                      </h3>
                      {app.specialty && (
                        <p className="text-xs font-medium text-primary">
                          {app.specialty}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(app)}
                        className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition cursor-pointer"
                        title={isBn ? 'সম্পাদনা' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteAppointment(app.id)}
                        className="p-1.5 text-danger-text hover:bg-danger-soft rounded-lg transition cursor-pointer"
                        title={isBn ? 'মুছুন' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-text-muted">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary shrink-0" />
                      <span>{app.appointmentDate}</span>
                      <Clock className="w-4 h-4 text-primary shrink-0 ml-2" />
                      <span>{app.appointmentTime}</span>
                    </div>

                    {app.location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                        <span>{app.location}</span>
                      </div>
                    )}

                    {app.notes && (
                      <div className="flex items-start gap-2 pt-1">
                        <FileText className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                        <span className="text-xs text-text-muted italic">
                          {app.notes}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => updateAppointment(app.id, { status: 'completed' })}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {isBn ? 'সম্পন্ন হিসেবে চিহ্নিত করুন' : 'Mark as Completed'}
                    </button>

                    {/* WhatsApp share reminder to patient / family */}
                    <button
                      onClick={() => {
                        const text = `${isBn ? 'ডাক্তারের অ্যাপয়েন্টমেন্ট' : 'Doctor Appointment'}: ${app.doctorName} (${app.specialty || ''})\n${isBn ? 'তারিখ' : 'Date'}: ${app.appointmentDate} at ${app.appointmentTime}\n${app.location ? `${isBn ? 'স্থান' : 'Location'}: ${app.location}\n` : ''}${isBn ? 'রোগী' : 'Patient'}: ${getPatientName(app.patientId)}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="text-xs text-text-muted hover:text-success-text flex items-center gap-1 cursor-pointer"
                      title={isBn ? 'শেয়ার করুন' : 'Share'}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {isBn ? 'শেয়ার' : 'Share'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Appointments Section */}
      {isLoadingPastAppointments && pastAppointments.length === 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-2.5 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>{isBn ? 'পূর্ববর্তী অ্যাপয়েন্টমেন্ট ইতিহাস লোড হচ্ছে…' : 'Loading past appointments…'}</span>
        </div>
      )}
      {pastAppointments.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-semibold text-text">
            {isBn ? 'পূর্ববর্তী অ্যাপয়েন্টমেন্ট ইতিহাস' : 'Past Appointments'}
          </h2>
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {pastAppointments.map((app) => (
              <div key={app.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text">
                      {app.doctorName}
                    </span>
                    {app.specialty && (
                      <span className="text-xs text-text-muted">
                        ({app.specialty})
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-xs bg-surface-2 text-text-muted">
                      {getPatientName(app.patientId)}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-3">
                    <span>{app.appointmentDate} • {app.appointmentTime}</span>
                    {app.location && <span>• {app.location}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-surface-2 text-text-muted">
                    {app.status === 'completed' ? (isBn ? 'সম্পন্ন' : 'Completed') : (isBn ? 'অতীত' : 'Past')}
                  </span>
                  <button
                    onClick={() => deleteAppointment(app.id)}
                    className="p-1.5 text-danger-text rounded-lg hover:bg-danger-soft cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-lg font-bold text-text flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {editingAppointment
                  ? isBn
                    ? 'অ্যাপয়েন্টমেন্ট সম্পাদনা'
                    : 'Edit Appointment'
                  : isBn
                  ? 'নতুন অ্যাপয়েন্টমেন্ট যোগ'
                  : 'Add New Appointment'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {isBn ? 'পরিবার সদস্য' : 'Family Member'} *
                </label>
                <select
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.relation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {isBn ? 'ডাক্তারের নাম' : 'Doctor Name'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={isBn ? 'উদা: ডা. কাজী নাজমুল হাসান' : 'e.g. Dr. Jane Smith'}
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {isBn ? 'বিশেষজ্ঞতা / বিভাগ' : 'Specialty / Department'}
                </label>
                <input
                  type="text"
                  placeholder={isBn ? 'উদা: হৃদরোগ বিশেষজ্ঞ, মেডিসিন' : 'e.g. Cardiologist'}
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    {isBn ? 'তারিখ' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">
                    {isBn ? 'সময়' : 'Time'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="10:30 AM"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {isBn ? 'হাসপাতাল / চেম্বার ঠিকানা' : 'Hospital / Clinic Location'}
                </label>
                <input
                  type="text"
                  placeholder={isBn ? 'উদা: ধানমন্ডি চেম্বার, রুম নং ২০৪' : 'e.g. City Hospital, Room 204'}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {isBn ? 'নোট / নির্দেশিকা' : 'Notes / Instructions'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isBn ? 'উদা: আগের টেস্ট রিপোর্ট সঙ্গে নিতে হবে' : 'e.g. Bring previous blood reports'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-surface-2 rounded-xl cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
                >
                  {isBn ? 'সংরক্ষণ করুন' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
