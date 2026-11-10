import React, { useState, useEffect } from 'react';
import { useMedicine } from '../../context/MedicineContext';
import { PatientProfile } from '../../types';
import { X, User, ShieldAlert, Heart, Check, Trash2, Archive, RotateCcw } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPatient: PatientProfile | null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  editingPatient,
}) => {
  const { addPatient, updatePatient, deletePatient, archivePatient, unarchivePatient, showToast } = useMedicine();

  const [name, setName] = useState('');
  const [relation, setRelation] = useState('নিজ');
  const [age, setAge] = useState<number>(35);
  const [gender, setGender] = useState<'পুরুষ' | 'মহিলা' | 'অন্যান্য'>('পুরুষ');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [chronicConditions, setChronicConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (editingPatient) {
      setName(editingPatient.name);
      setRelation(editingPatient.relation);
      setAge(editingPatient.age);
      setGender(editingPatient.gender);
      setBloodGroup(editingPatient.bloodGroup);
      setChronicConditions(editingPatient.chronicConditions.join(', '));
      setAllergies(editingPatient.allergies.join(', '));
      setEmergencyContact(editingPatient.emergencyContact || '');
      setAvatarUrl(editingPatient.avatarUrl || '');
    } else {
      setName('');
      setRelation('নিজ');
      setAge(35);
      setGender('পুরুষ');
      setBloodGroup('O+');
      setChronicConditions('');
      setAllergies('');
      setEmergencyContact('');
      setAvatarUrl('');
    }
    setErrorMessage('');
  }, [editingPatient, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('অনুগ্রহ করে রোগীর নাম লিখুন');
      return;
    }
    if (age <= 0 || age > 150) {
      setErrorMessage('সঠিক বয়স উল্লেখ করুন (১-১৫০)');
      return;
    }

    const patientData = {
      name: name.trim(),
      relation: relation.trim(),
      age: Number(age),
      gender,
      bloodGroup,
      chronicConditions: chronicConditions
        ? chronicConditions.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      allergies: allergies
        ? allergies.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      emergencyContact: emergencyContact.trim(),
      avatarUrl: avatarUrl.trim() || undefined,
    };

    if (editingPatient) {
      updatePatient(editingPatient.id, patientData);
    } else {
      addPatient(patientData);
    }

    onClose();
  };

  const handleDelete = () => {
    if (!editingPatient) return;
    if (window.confirm(`আপনি কি নিশ্চিত যে "${editingPatient.name}" এর প্রোফাইল মুছে ফেলতে চান? (ওষুধের তালিকা মুছে যাবে না)`)) {
      deletePatient(editingPatient.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-lg">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingPatient ? 'প্রোফাইল সম্পাদনা করুন' : 'নতুন রোগীর প্রোফাইল তৈরি করুন'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editingPatient
                ? 'সদস্যের তথ্য ও স্বাস্থ্য ইতিহাস হালনাগাদ করুন'
                : 'আপনার নিজের বা পরিবারের যেকোনো সদস্যের জন্য আনলিমিটেড প্রোফাইল যোগ করুন'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Row 1: Name and Relation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                রোগীর পুরো নাম *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: মো: আব্দুল করিম"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                সম্পর্ক *
              </label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value="নিজ">নিজ (Self)</option>
                <option value="বাবা">বাবা (Father)</option>
                <option value="মা">মা (Mother)</option>
                <option value="স্বামী">স্বামী (Husband)</option>
                <option value="স্ত্রী">স্ত্রী (Wife)</option>
                <option value="সন্তান">সন্তান (Child)</option>
                <option value="ভাই">ভাই (Brother)</option>
                <option value="বোন">বোন (Sister)</option>
                <option value="দাদা/নানা">দাদা/নানা (Grandfather)</option>
                <option value="দাদী/নানী">দাদী/নানী (Grandmother)</option>
                <option value="অন্যান্য">অন্যান্য (Other)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Age, Gender, Blood Group */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                বয়স *
              </label>
              <input
                type="number"
                min="1"
                max="150"
                required
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500 text-center font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                লিঙ্গ
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'পুরুষ' | 'মহিলা' | 'অন্যান্য')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value="পুরুষ">পুরুষ</option>
                <option value="মহিলা">মহিলা</option>
                <option value="অন্যান্য">অন্যান্য</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                রক্তের গ্রুপ
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden cursor-pointer font-medium"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="অজানা">অজানা</option>
              </select>
            </div>
          </div>

          {/* Row 3: Emergency Contact */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              জরুরি যোগাযোগের নম্বর (Emergency Contact)
            </label>
            <input
              type="text"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="যেমন: +৮৮০ ১৭ ১২৩৪ ৫৬৭৮"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          {/* Row 4: Chronic Conditions */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              দীর্ঘমেয়াদী রোগ (কমা দিয়ে আলাদা করুন)
            </label>
            <input
              type="text"
              value={chronicConditions}
              onChange={(e) => setChronicConditions(e.target.value)}
              placeholder="যেমন: ডায়াবেটিস, উচ্চ রক্তচাপ, হাঁপানি"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          {/* Row 5: Known Drug Allergies */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              পরিচিত ড্রাগ অ্যালার্জি (সতর্কতা)
            </label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="যেমন: সালফা ড্রাগ, পেনিসিলিন, অ্যাসপিরিন"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            {editingPatient ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>মুছুন</span>
                </button>
                {editingPatient.isArchived ? (
                  <button
                    type="button"
                    onClick={() => {
                      unarchivePatient(editingPatient.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>পুনরায় সক্রিয় করুন</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      archivePatient(editingPatient.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-xs font-medium"
                    title="প্রোফাইল আর্কাইভ করলেও সকল ওষুধ ও ইতিহাস সম্পূর্ণ সুরক্ষিত থাকবে"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-500" />
                    <span>আর্কাইভ করুন</span>
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{editingPatient ? 'হালনাগাদ করুন' : 'প্রোফাইল তৈরি করুন'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
