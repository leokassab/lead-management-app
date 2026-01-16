import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Button, Modal } from '../ui'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { checkBatchForDuplicates, markAsDuplicate, type DuplicateCheckResult } from '../../services/duplicateService'
import type { CustomStatus, User, FormationType } from '../../types'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  statuses: CustomStatus[]
  teamMembers: User[]
  formationTypes?: FormationType[]
}

type ParsedRow = Record<string, string>

const LEAD_FIELDS = [
  { value: '', label: 'Ignorer cette colonne' },
  { value: 'first_name', label: 'Prénom' },
  { value: 'last_name', label: 'Nom' },
  { value: 'full_name', label: 'Nom complet' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'company_name', label: 'Entreprise' },
  { value: 'job_title', label: 'Poste' },
  { value: 'linkedin_url', label: 'LinkedIn' },
  { value: 'website', label: 'Site web' },
  { value: 'city', label: 'Ville' },
  { value: 'country', label: 'Pays' },
  { value: 'sector', label: 'Secteur' },
  { value: 'company_size', label: 'Taille entreprise' },
  { value: 'lead_type', label: 'Type (B2B/B2C)' },
  { value: 'formation_type', label: 'Type de formation' },
  { value: 'notes', label: 'Notes' },
]

// Auto-detect column mapping based on header names
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  const patterns: Record<string, RegExp[]> = {
    first_name: [/^pr[eé]nom$/i, /^first.?name$/i, /^firstname$/i],
    last_name: [/^nom$/i, /^last.?name$/i, /^lastname$/i, /^family.?name$/i],
    full_name: [/^nom.?complet$/i, /^full.?name$/i, /^name$/i],
    email: [/^e?.?mail$/i, /^courriel$/i],
    phone: [/^t[eé]l[eé]?phone?$/i, /^phone$/i, /^mobile$/i, /^portable$/i],
    company_name: [/^entreprise$/i, /^soci[eé]t[eé]$/i, /^company$/i, /^organization$/i],
    job_title: [/^poste$/i, /^fonction$/i, /^job.?title$/i, /^title$/i, /^position$/i],
    linkedin_url: [/^linkedin$/i, /^profil.?linkedin$/i],
    website: [/^site$/i, /^website$/i, /^url$/i, /^site.?web$/i],
    city: [/^ville$/i, /^city$/i, /^localit[eé]$/i],
    country: [/^pays$/i, /^country$/i],
    sector: [/^secteur$/i, /^sector$/i, /^industry$/i, /^industrie$/i],
    company_size: [/^taille$/i, /^size$/i, /^effectif$/i, /^employees$/i],
    lead_type: [/^type$/i, /^b2b.?b2c$/i],
    formation_type: [/^formation$/i, /^type.?formation$/i, /^cours$/i, /^programme$/i, /^training$/i],
    notes: [/^notes?$/i, /^commentaires?$/i, /^remarks?$/i],
  }

  headers.forEach(header => {
    const normalizedHeader = header.trim()
    for (const [field, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(normalizedHeader))) {
        mapping[header] = field
        break
      }
    }
  })

  return mapping
}

export default function ImportModal({
  isOpen,
  onClose,
  onSuccess,
  statuses,
  teamMembers,
  formationTypes = [],
}: ImportModalProps) {
  const { profile } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step management
  const [step, setStep] = useState(1)

  // Step 1: File upload
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')

  // Step 2: Parsed data & mapping
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})

  // Step 3: Options
  const [assignTo, setAssignTo] = useState<string>('round_robin')
  const [defaultStatus, setDefaultStatus] = useState(statuses[0]?.name || 'Opt-in')
  const [defaultPriority, setDefaultPriority] = useState('cold')
  const [createMissingFormations, setCreateMissingFormations] = useState(false)

  // Step 4: Import
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importError, setImportError] = useState('')

  // Duplicate detection
  const [duplicatesMap, setDuplicatesMap] = useState<Map<number, DuplicateCheckResult>>(new Map())
  const [skipDuplicates, setSkipDuplicates] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFileError('')

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    const isCSV = selectedFile.name.endsWith('.csv')
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')

    if (!validTypes.includes(selectedFile.type) && !isCSV && !isExcel) {
      setFileError('Format non supporté. Utilisez un fichier CSV ou Excel.')
      return
    }

    if (isExcel) {
      setFileError('Les fichiers Excel ne sont pas encore supportés. Veuillez utiliser un fichier CSV.')
      return
    }

    setFile(selectedFile)

    // Parse CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setFileError('Erreur lors de la lecture du fichier: ' + results.errors[0].message)
          return
        }

        const parsedHeaders = results.meta.fields || []
        const parsedRows = results.data as ParsedRow[]

        setHeaders(parsedHeaders)
        setRows(parsedRows)

        // Auto-detect mapping
        const detectedMapping = autoDetectMapping(parsedHeaders)
        setMapping(detectedMapping)

        // Move to step 2
        setStep(2)
      },
      error: (error) => {
        setFileError('Erreur lors de la lecture du fichier: ' + error.message)
      }
    })
  }

  const handleMappingChange = (header: string, field: string) => {
    setMapping(prev => ({ ...prev, [header]: field }))
  }

  const getMappedLeadCount = () => {
    // Count leads that have at least a name or email
    const hasName = Object.values(mapping).some(v => v === 'first_name' || v === 'last_name' || v === 'full_name')
    const hasEmail = Object.values(mapping).some(v => v === 'email')
    return hasName || hasEmail ? rows.length : 0
  }

  const getDuplicatesCount = () => duplicatesMap.size

  const getLeadsToImportCount = () => {
    if (skipDuplicates) {
      return getMappedLeadCount() - getDuplicatesCount()
    }
    return getMappedLeadCount()
  }

  // Check for duplicates before moving to step 4
  const handleProceedToStep4 = async () => {
    if (!profile?.team_id) return

    setCheckingDuplicates(true)

    try {
      // Find email and phone column headers
      const emailHeader = Object.entries(mapping).find(([, field]) => field === 'email')?.[0]
      const phoneHeader = Object.entries(mapping).find(([, field]) => field === 'phone')?.[0]

      if (emailHeader || phoneHeader) {
        // Prepare leads for duplicate check
        const leadsToCheck = rows.map((row, index) => ({
          email: emailHeader ? row[emailHeader]?.trim() : undefined,
          phone: phoneHeader ? row[phoneHeader]?.trim() : undefined,
          index,
        }))

        const duplicates = await checkBatchForDuplicates(profile.team_id, leadsToCheck)
        setDuplicatesMap(duplicates)
      } else {
        setDuplicatesMap(new Map())
      }

      setStep(4)
    } catch (error) {
      console.error('Error checking duplicates:', error)
      setStep(4)
    } finally {
      setCheckingDuplicates(false)
    }
  }

  const handleImport = async () => {
    if (!profile?.team_id) return

    setImporting(true)
    setImportError('')
    setImportProgress(0)

    try {
      // Build formation type map (name -> id) for quick lookup
      const formationTypeMap = new Map<string, string>()
      formationTypes.forEach(ft => {
        formationTypeMap.set(ft.name.toLowerCase(), ft.id)
      })

      // If formation_type is mapped, collect unique formation names from CSV
      const formationHeader = Object.entries(mapping).find(([, field]) => field === 'formation_type')?.[0]
      if (formationHeader && createMissingFormations) {
        const uniqueFormations = new Set<string>()
        rows.forEach(row => {
          const formationName = row[formationHeader]?.trim()
          if (formationName && !formationTypeMap.has(formationName.toLowerCase())) {
            uniqueFormations.add(formationName)
          }
        })

        // Create missing formation types
        if (uniqueFormations.size > 0) {
          const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
          let colorIndex = formationTypes.length

          for (const formationName of uniqueFormations) {
            const { data, error } = await supabase
              .from('formation_types')
              .insert({
                team_id: profile.team_id,
                name: formationName,
                color: colors[colorIndex % colors.length],
                order_position: formationTypes.length + colorIndex,
                is_active: true,
              })
              .select()
              .single()

            if (!error && data) {
              formationTypeMap.set(formationName.toLowerCase(), data.id)
              colorIndex++
            }
          }
        }
      }

      // Track which rows are duplicates for marking after insert
      const duplicateRowIndices: number[] = []
      const leadsToInsert: Array<{ data: Record<string, unknown>; rowIndex: number }>  = []
      let roundRobinIndex = 0

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const isDuplicate = duplicatesMap.has(i)

        // Skip duplicates if option is enabled
        if (isDuplicate && skipDuplicates) {
          continue
        }

        const lead: Record<string, unknown> = {
          team_id: profile.team_id,
          source: 'import_csv',
          status: defaultStatus,
          priority: defaultPriority,
          is_decision_maker: false,
          ai_analyzed: false,
          tags: [],
          custom_fields: {},
        }

        // Map fields
        for (const [header, field] of Object.entries(mapping)) {
          if (field && row[header]) {
            if (field === 'formation_type') {
              // Map formation_type to formation_type_id
              const formationName = row[header].trim()
              const formationId = formationTypeMap.get(formationName.toLowerCase())
              if (formationId) {
                lead.formation_type_id = formationId
              }
            } else {
              lead[field] = row[header].trim()
            }
          }
        }

        // Generate full_name if not provided
        if (!lead.full_name && (lead.first_name || lead.last_name)) {
          lead.full_name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
        }

        // Assign lead
        if (assignTo === 'round_robin') {
          if (teamMembers.length > 0) {
            lead.assigned_to = teamMembers[roundRobinIndex % teamMembers.length].id
            roundRobinIndex++
          }
        } else if (assignTo !== 'none' && assignTo !== 'rules') {
          lead.assigned_to = assignTo
        }

        // Only add if there's meaningful data
        if (lead.full_name || lead.email || lead.phone) {
          leadsToInsert.push({ data: lead, rowIndex: i })
          if (isDuplicate) {
            duplicateRowIndices.push(leadsToInsert.length - 1)
          }
        }

        setImportProgress(Math.round((i / rows.length) * 50))
      }

      if (leadsToInsert.length === 0) {
        setImportError('Aucun lead valide à importer. Vérifiez le mapping des colonnes.')
        setImporting(false)
        return
      }

      // Batch insert (Supabase supports up to 1000 rows at once)
      const batchSize = 500
      const insertedLeadIds: Array<{ id: string; batchIndex: number }> = []

      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize).map(item => item.data)
        const { data: insertedData, error } = await supabase
          .from('leads')
          .insert(batch)
          .select('id')

        if (error) throw error

        // Track inserted lead IDs with their batch position
        if (insertedData) {
          insertedData.forEach((lead, idx) => {
            insertedLeadIds.push({ id: lead.id, batchIndex: i + idx })
          })
        }

        setImportProgress(50 + Math.round((i / leadsToInsert.length) * 40))
      }

      // Mark duplicates if not skipping
      if (!skipDuplicates && duplicateRowIndices.length > 0) {
        setImportProgress(90)

        for (const batchIndex of duplicateRowIndices) {
          const insertedLead = insertedLeadIds[batchIndex]
          if (!insertedLead) continue

          const originalRowIndex = leadsToInsert[batchIndex].rowIndex
          const dupInfo = duplicatesMap.get(originalRowIndex)

          if (dupInfo && dupInfo.originalLead) {
            await markAsDuplicate(
              insertedLead.id,
              dupInfo.originalLead.id,
              dupInfo.matchingFields,
              profile.team_id
            )
          }
        }
      }

      setImportProgress(100)

      // Success
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 500)
    } catch (error) {
      console.error('Import error:', error)
      setImportError(error instanceof Error ? error.message : 'Erreur lors de l\'import')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setFile(null)
    setFileError('')
    setHeaders([])
    setRows([])
    setMapping({})
    setImporting(false)
    setImportProgress(0)
    setImportError('')
    setDuplicatesMap(new Map())
    setSkipDuplicates(false)
    setCheckingDuplicates(false)
    onClose()
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
      >
        <div className="text-4xl mb-4">📁</div>
        <p className="text-gray-600 mb-2">
          Glissez votre fichier ici ou <span className="text-blue-600">cliquez pour sélectionner</span>
        </p>
        <p className="text-sm text-gray-500">CSV (.csv) - Max 10 000 lignes</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {fileError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {fileError}
        </div>
      )}

      {file && (
        <div className="p-3 bg-gray-50 rounded flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
            ✕
          </Button>
        </div>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800">
          <strong>{rows.length}</strong> lignes détectées. Associez les colonnes de votre fichier aux champs correspondants.
        </p>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {headers.map(header => (
          <div key={header} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
            <div className="w-1/3">
              <span className="font-medium text-gray-700">{header}</span>
              {rows[0]?.[header] && (
                <p className="text-xs text-gray-500 truncate mt-1">
                  Ex: {rows[0][header]}
                </p>
              )}
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex-1">
              <select
                value={mapping[header] || ''}
                onChange={(e) => handleMappingChange(header, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                {LEAD_FIELDS.map(field => (
                  <option key={field.value} value={field.value}>{field.label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep(1)}>
          ← Retour
        </Button>
        <Button onClick={() => setStep(3)} disabled={getMappedLeadCount() === 0}>
          Suivant →
        </Button>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assigner les leads à
          </label>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="round_robin">🔄 Round-robin (répartition équitable)</option>
            <option value="none">❌ Ne pas assigner</option>
            {teamMembers.map(member => (
              <option key={member.id} value={member.id}>
                👤 {member.first_name} {member.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Statut par défaut
          </label>
          <select
            value={defaultStatus}
            onChange={(e) => setDefaultStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            {statuses.map(status => (
              <option key={status.id} value={status.name}>{status.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priorité par défaut
          </label>
          <select
            value={defaultPriority}
            onChange={(e) => setDefaultPriority(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="cold">⚪ Cold</option>
            <option value="warm">🟢 Warm</option>
            <option value="hot">🟠 Hot</option>
            <option value="urgent">🔴 Urgent</option>
          </select>
        </div>

        {/* Formation type option - only show if formation_type is mapped */}
        {Object.values(mapping).includes('formation_type') && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createMissingFormations}
                onChange={(e) => setCreateMissingFormations(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <div>
                <span className="font-medium text-blue-800">
                  🎓 Créer automatiquement les types de formation manquants
                </span>
                <p className="text-sm text-blue-600 mt-1">
                  Les nouveaux types seront créés dans Paramètres &gt; Formations
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep(2)}>
          ← Retour
        </Button>
        <Button onClick={handleProceedToStep4} disabled={checkingDuplicates}>
          {checkingDuplicates ? 'Vérification des doublons...' : 'Suivant →'}
        </Button>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Success message or duplicate warning */}
      {getDuplicatesCount() > 0 ? (
        <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">&#9888;&#65039;</span>
            <div className="flex-1">
              <p className="text-orange-800 font-medium">
                {getDuplicatesCount()} doublon{getDuplicatesCount() > 1 ? 's' : ''} détecté{getDuplicatesCount() > 1 ? 's' : ''} sur {getMappedLeadCount()} leads
              </p>
              <p className="text-sm text-orange-600 mt-1">
                Ces contacts existent déjà dans votre base ou apparaissent plusieurs fois dans le fichier.
              </p>

              {/* Option to skip duplicates */}
              <div className="mt-3 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateAction"
                    checked={!skipDuplicates}
                    onChange={() => setSkipDuplicates(false)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    Importer et marquer comme doublons ({getMappedLeadCount()} leads)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateAction"
                    checked={skipDuplicates}
                    onChange={() => setSkipDuplicates(true)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    Ignorer les doublons ({getLeadsToImportCount()} leads)
                  </span>
                </label>
              </div>

              {/* List some duplicates */}
              <div className="mt-3 text-xs text-orange-700">
                <span className="font-medium">Exemples de doublons:</span>
                <ul className="mt-1 space-y-0.5 max-h-20 overflow-y-auto">
                  {Array.from(duplicatesMap.entries()).slice(0, 3).map(([index, dupResult]) => {
                    const row = rows[index]
                    const emailHeader = Object.entries(mapping).find(([, field]) => field === 'email')?.[0]
                    const nameHeader = Object.entries(mapping).find(([, field]) =>
                      field === 'full_name' || field === 'first_name'
                    )?.[0]
                    const displayName = nameHeader ? row[nameHeader] : (emailHeader ? row[emailHeader] : `Ligne ${index + 2}`)

                    return (
                      <li key={index}>
                        • {displayName} - {dupResult.matchingFields.join(', ')}
                        {dupResult.originalLead && (
                          <span className="text-orange-500"> (existant: {dupResult.originalLead.full_name || dupResult.originalLead.email})</span>
                        )}
                      </li>
                    )
                  })}
                  {getDuplicatesCount() > 3 && (
                    <li className="text-orange-500">... et {getDuplicatesCount() - 3} autre{getDuplicatesCount() - 3 > 1 ? 's' : ''}</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">
            &#10003; {getMappedLeadCount()} leads prêts à être importés - Aucun doublon détecté
          </p>
        </div>
      )}

      {/* Preview */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <p className="text-sm text-gray-600">Aperçu des 5 premiers leads</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {Object.entries(mapping)
                  .filter(([, field]) => field)
                  .slice(0, 5)
                  .map(([header, field]) => (
                    <th key={header} className="px-4 py-2 text-left text-gray-600">
                      {LEAD_FIELDS.find(f => f.value === field)?.label || field}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-t">
                  {Object.entries(mapping)
                    .filter(([, field]) => field)
                    .slice(0, 5)
                    .map(([header]) => (
                      <td key={header} className="px-4 py-2 truncate max-w-32">
                        {row[header] || '-'}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Leads à importer</span>
          <span className="font-medium">{getLeadsToImportCount()}</span>
        </div>
        {getDuplicatesCount() > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Doublons détectés</span>
            <span className={`font-medium ${skipDuplicates ? 'text-orange-600' : 'text-gray-600'}`}>
              {getDuplicatesCount()} {skipDuplicates ? '(ignorés)' : '(seront marqués)'}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">Attribution</span>
          <span className="font-medium">
            {assignTo === 'round_robin' ? 'Round-robin' :
             assignTo === 'none' ? 'Non assigné' :
             teamMembers.find(m => m.id === assignTo)?.first_name || 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Statut</span>
          <span className="font-medium">{defaultStatus}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Priorité</span>
          <span className="font-medium">{defaultPriority}</span>
        </div>
      </div>

      {importError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {importError}
        </div>
      )}

      {importing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Import en cours...</span>
            <span>{importProgress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep(3)} disabled={importing}>
          &#8592; Retour
        </Button>
        <Button onClick={handleImport} disabled={importing || getLeadsToImportCount() === 0}>
          {importing ? 'Import en cours...' : `&#128229; Importer ${getLeadsToImportCount()} leads`}
        </Button>
      </div>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="&#128229; Importer des leads" size="lg">
      {/* Steps indicator */}
      <div className="flex items-center justify-between mb-6 px-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? 'bg-blue-600 text-white'
                  : s < step
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            {s < 4 && (
              <div className={`w-16 h-1 mx-2 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step labels */}
      <div className="flex justify-between mb-6 text-xs text-gray-500 px-2">
        <span>Fichier</span>
        <span>Mapping</span>
        <span>Options</span>
        <span>Import</span>
      </div>

      {/* Content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </Modal>
  )
}
