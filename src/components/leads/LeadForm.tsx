import { useState } from 'react'
import { Button, Input, Select, Textarea, Modal } from '../ui'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { Lead, CustomStatus, User } from '../../types'

interface LeadFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  lead?: Lead | null
  statuses: CustomStatus[]
  teamMembers: User[]
}

const SOURCES = [
  { value: 'manual', label: 'Saisie manuelle' },
  { value: 'import_csv', label: 'Import CSV' },
  { value: 'import_excel', label: 'Import Excel' },
  { value: 'web_form', label: 'Formulaire web' },
  { value: 'email', label: 'Email' },
  { value: 'api', label: 'API' },
]

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employés' },
  { value: '11-50', label: '11-50 employés' },
  { value: '51-200', label: '51-200 employés' },
  { value: '201-500', label: '201-500 employés' },
  { value: '500+', label: '500+ employés' },
]

const LEAD_TYPES = [
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C' },
]

const PRIORITIES = [
  { value: 'cold', label: '⚪ Cold' },
  { value: 'warm', label: '🟢 Warm' },
  { value: 'hot', label: '🟠 Hot' },
  { value: 'urgent', label: '🔴 Urgent' },
]

export default function LeadForm({
  isOpen,
  onClose,
  onSuccess,
  lead,
  statuses,
  teamMembers,
}: LeadFormProps) {
  const { profile } = useAuthStore()
  const isEditing = !!lead

  const [formData, setFormData] = useState({
    first_name: lead?.first_name || '',
    last_name: lead?.last_name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    company_name: lead?.company_name || '',
    job_title: lead?.job_title || '',
    linkedin_url: lead?.linkedin_url || '',
    website: lead?.website || '',
    city: lead?.city || '',
    country: lead?.country || 'France',
    sector: lead?.sector || '',
    company_size: lead?.company_size || '',
    lead_type: lead?.lead_type || 'B2B',
    source: lead?.source || 'manual',
    priority: lead?.priority || 'cold',
    status: lead?.status || statuses[0]?.name || 'Opt-in',
    assigned_to: lead?.assigned_to || profile?.id || '',
    notes: lead?.notes || '',
    is_decision_maker: lead?.is_decision_maker || false,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const leadData = {
        ...formData,
        full_name: `${formData.first_name} ${formData.last_name}`.trim(),
        team_id: profile?.team_id,
        updated_at: new Date().toISOString(),
      }

      if (isEditing && lead) {
        const { error: updateError } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', lead.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('leads')
          .insert(leadData)

        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving lead:', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const statusOptions = statuses.map(s => ({ value: s.name, label: s.name }))
  const memberOptions = teamMembers.map(m => ({
    value: m.id,
    label: `${m.first_name} ${m.last_name}`,
  }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier le lead' : 'Nouveau lead'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Informations personnelles */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Informations personnelles</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prénom"
              value={formData.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              required
            />
            <Input
              label="Nom"
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            <Input
              label="Téléphone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
        </div>

        {/* Entreprise */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Entreprise</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Entreprise"
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
            />
            <Input
              label="Poste"
              value={formData.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
            />
            <Input
              label="Secteur"
              value={formData.sector}
              onChange={(e) => handleChange('sector', e.target.value)}
              placeholder="Ex: Digital, Santé, Finance..."
            />
            <Select
              label="Taille entreprise"
              value={formData.company_size}
              onChange={(e) => handleChange('company_size', e.target.value)}
              options={COMPANY_SIZES}
              placeholder="Sélectionner..."
            />
            <Input
              label="Site web"
              type="url"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://..."
            />
            <Input
              label="LinkedIn"
              type="url"
              value={formData.linkedin_url}
              onChange={(e) => handleChange('linkedin_url', e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
        </div>

        {/* Localisation */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Localisation</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ville"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
            <Input
              label="Pays"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
            />
          </div>
        </div>

        {/* Classification */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Classification</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={formData.lead_type}
              onChange={(e) => handleChange('lead_type', e.target.value)}
              options={LEAD_TYPES}
            />
            <Select
              label="Source"
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              options={SOURCES}
            />
            <Select
              label="Statut"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              options={statusOptions}
            />
            <Select
              label="Priorité"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              options={PRIORITIES}
            />
            <Select
              label="Assigné à"
              value={formData.assigned_to}
              onChange={(e) => handleChange('assigned_to', e.target.value)}
              options={memberOptions}
              placeholder="Sélectionner..."
            />
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_decision_maker"
                checked={formData.is_decision_maker}
                onChange={(e) => handleChange('is_decision_maker', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_decision_maker" className="text-sm text-gray-700">
                Décisionnaire
              </label>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
            placeholder="Notes sur ce lead..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Créer le lead'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
