
import React from 'react'
import { EnsureMatchingConfigColumn } from '@/components/Settings/ensureMatchingConfigColumn'

export default function ProductMatching2() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Product Matching Configuration</h1>
      <EnsureMatchingConfigColumn />
    </div>
  )
}
